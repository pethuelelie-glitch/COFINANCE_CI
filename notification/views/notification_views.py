from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from notification.models import Notification
from notification.serializers import NotificationSerializer

class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Notifications'],
        summary="Mes notifications",
        description="Liste toutes les notifications de l'utilisateur connecté, triées par date.",
        responses={200: NotificationSerializer(many=True)}
    )
    def get(self, request):
        notifications = Notification.objects.filter(destinataire=request.user)
        return Response(NotificationSerializer(notifications, many=True).data)

class NotificationReadView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Notifications'],
        summary="Marquer comme lue",
        description="Marque une notification spécifique comme lue.",
        responses={200: NotificationSerializer}
    )
    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, destinataire=request.user)
            notif.lu = True
            notif.save()
            return Response(NotificationSerializer(notif).data)
        except Notification.DoesNotExist:
            return Response({'error': 'Non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

class NotificationReadAllView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Notifications'],
        summary="Tout marquer lu",
        description="Marque toutes les notifications non lues comme lues.",
        responses={200: {'description': 'Opération réussie'}}
    )
    def patch(self, request):
        Notification.objects.filter(destinataire=request.user, lu=False).update(lu=True)
        return Response({'success': True, 'message': 'Toutes les notifications ont été marquées comme lues.'})

class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Notifications'],
        summary="Nombre de non lues",
        responses={200: {'type': 'object', 'properties': {'count': {'type': 'integer'}}}}
    )
    def get(self, request):
        count = Notification.objects.filter(destinataire=request.user, lu=False).count()
        return Response({'count': count})
