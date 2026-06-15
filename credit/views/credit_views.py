from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from account.permission import IsAgentOrAdmin, IsOwnerOrAgentOrAdmin
from credit.models import CreditRequest, CreditStatus
from credit.serializers import CreditRequestSerializer, RepaymentScheduleSerializer
from credit.services import CreditService


@extend_schema(tags=['Credits'])
class CreditRequestViewSet(viewsets.ModelViewSet):
    """
    Gestion des demandes de crédit.
    - Client : Soumettre, lister ses demandes, voir les détails.
    - Agent/Admin : Lister toutes les demandes, changer le statut.
    """
    serializer_class = CreditRequestSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAgentOrAdmin]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if user.role in ('AGENT', 'ADMIN'):
            return CreditRequest.objects.select_related('client', 'agent').all()
        return CreditRequest.objects.filter(client=user)

    def perform_create(self, serializer):
        if self.request.user.role != 'CLIENT':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Seuls les clients peuvent soumettre une demande.')

        credit = serializer.save(client=self.request.user)
        credit.calculate_score()

    @extend_schema(
        summary="Changer le statut d'une demande de crédit",
        description="Réservé aux Agents et Administrateurs.",
        request={'type': 'object', 'properties': {'statut': {'type': 'string', 'example': 'APPROUVEE'}}},
        responses={200: CreditRequestSerializer},
    )
    @action(detail=True, methods=['patch'], permission_classes=[IsAuthenticated, IsAgentOrAdmin])
    def status(self, request, pk=None):
        credit = self.get_object()
        new_status = request.data.get('statut')

        if new_status not in [choice[0] for choice in CreditStatus.choices]:
            return Response({'error': 'Statut invalide.'}, status=status.HTTP_400_BAD_REQUEST)

        CreditService.update_status(credit, new_status, request.user)
        credit.refresh_from_db()
        return Response(CreditRequestSerializer(credit).data)

    @extend_schema(
        summary="Voir l'échéancier d'un crédit",
        responses={200: RepaymentScheduleSerializer(many=True)},
    )
    @action(detail=True, methods=['get'])
    def schedule(self, request, pk=None):
        credit = self.get_object()
        schedules = credit.schedules.all()
        return Response(RepaymentScheduleSerializer(schedules, many=True).data)
