from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from account.permission import IsClient, IsAdmin, IsAgentOrAdmin
from chat.models import Conversation, ConversationStatus, Message
from chat.serializers import ConversationSerializer, MessageSerializer


class ConversationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Chat'],
        summary='Lister les conversations',
        responses={200: ConversationSerializer(many=True)},
    )
    def get(self, request):
        user = request.user
        if user.role == 'ADMIN':
            qs = Conversation.objects.select_related('client', 'agent').prefetch_related('messages').all()
        elif user.role == 'AGENT':
            qs = Conversation.objects.filter(agent=user).select_related('client', 'agent').prefetch_related('messages')
        else:
            qs = Conversation.objects.filter(client=user).prefetch_related('messages')
        return Response(ConversationSerializer(qs, many=True, context={'request': request}).data)

    @extend_schema(
        tags=['Chat'],
        summary='Ouvrir une conversation',
        request=ConversationSerializer,
        responses={201: ConversationSerializer},
    )
    def post(self, request):
        if request.user.role != 'CLIENT':
            return Response(
                {'error': 'Seuls les clients peuvent ouvrir une conversation.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        conversation = Conversation.objects.create(client=request.user)
        return Response(
            ConversationSerializer(conversation).data,
            status=status.HTTP_201_CREATED,
        )


class ConversationMessagesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Chat'],
        summary='Historique des messages',
        responses={200: MessageSerializer(many=True)},
    )
    def get(self, request, pk):
        try:
            conversation = Conversation.objects.get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        if not self._can_access(request.user, conversation):
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)

        messages = conversation.messages.select_related('auteur').all()
        return Response(MessageSerializer(messages, many=True).data)

    def _can_access(self, user, conversation):
        if user.role == 'ADMIN':
            return True
        if user.role == 'AGENT':
            return conversation.agent_id in (None, user.id)
        return conversation.client_id == user.id


class ConversationAssignView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    @extend_schema(
        tags=['Chat'],
        summary='Assigner un agent à une conversation',
        request={'type': 'object', 'properties': {'agent_id': {'type': 'integer'}}},
        responses={200: ConversationSerializer},
    )
    def patch(self, request, pk):
        try:
            conversation = Conversation.objects.get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        agent_id = request.data.get('agent_id')
        if not agent_id:
            return Response({'error': 'agent_id requis.'}, status=status.HTTP_400_BAD_REQUEST)

        from account.models import CustomUser, UserRole
        try:
            agent = CustomUser.objects.get(pk=agent_id, role=UserRole.AGENT)
        except CustomUser.DoesNotExist:
            return Response({'error': 'Agent introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        conversation.agent = agent
        conversation.statut = ConversationStatus.EN_COURS
        conversation.save()
        return Response(ConversationSerializer(conversation).data)


class ConversationCloseView(APIView):
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Chat'],
        summary='Fermer une conversation',
        responses={200: ConversationSerializer},
    )
    def patch(self, request, pk):
        try:
            conversation = Conversation.objects.get(pk=pk)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        conversation.statut = ConversationStatus.FERMEE
        conversation.save()
        return Response(ConversationSerializer(conversation).data)
