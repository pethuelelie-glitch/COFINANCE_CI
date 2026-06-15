from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema
from django.utils import timezone

from account.permission import IsAgent, IsAgentOrAdmin, IsOwnerOrAgentOrAdmin
from repayements.models import Payment
from repayements.serializers import PaymentSerializer
from credit.models import RepaymentSchedule
from credit.serializers import RepaymentScheduleSerializer


class PaymentView(APIView):
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Remboursements'],
        summary="Enregistrer un paiement",
        description="L'agent enregistre le paiement d'une échéance.",
        request=PaymentSerializer,
        responses={201: PaymentSerializer},
    )
    def post(self, request):
        serializer = PaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save(agent=request.user)
        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class HistoryView(APIView):
    permission_classes = [IsAuthenticated, IsOwnerOrAgentOrAdmin]

    @extend_schema(
        tags=['Remboursements'],
        summary="Échéancier d'un client",
        description="Retourne toutes les échéances (RepaymentSchedule) d'un client.",
        responses={200: RepaymentScheduleSerializer(many=True)},
    )
    def get(self, request, client_id):
        if request.user.role == 'CLIENT' and request.user.id != int(client_id):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Vous ne pouvez voir que votre propre historique.')

        schedules = RepaymentSchedule.objects.filter(
            credit__client__id=client_id
        ).select_related('credit', 'credit__client').order_by('date_echeance')
        return Response(RepaymentScheduleSerializer(schedules, many=True).data)


class OverdueView(APIView):
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Remboursements'],
        summary="Échéances en retard",
        description="Retourne toutes les échéances dont la date est dépassée et non payées.",
        responses={200: RepaymentScheduleSerializer(many=True)},
    )
    def get(self, request):
        today = timezone.now().date()
        schedules = RepaymentSchedule.objects.filter(
            date_echeance__lt=today,
            statut__in=[RepaymentSchedule.Status.EN_ATTENTE, RepaymentSchedule.Status.EN_RETARD],
        ).select_related('credit', 'credit__client')
        return Response(RepaymentScheduleSerializer(schedules, many=True).data)
