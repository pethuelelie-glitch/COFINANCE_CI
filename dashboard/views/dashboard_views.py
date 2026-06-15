from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django.db.models import Sum
from django.utils import timezone
from datetime import timedelta

from account.permission import IsAdmin, IsAgentOrAdmin
from account.models import CustomUser
from credit.models import CreditRequest, CreditStatus, RepaymentSchedule
from repayements.models import Payment
from insurance.models import InsurancePolicy, PolicyStatus
from chat.models import Conversation, ConversationStatus


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Dashboard'],
        summary="Statistiques du tableau de bord",
        description="Agrège les KPIs de tous les modules (Crédits, Remboursements, Assurances, Support). Les agents ne voient que leurs crédits assignés.",
        parameters=[
            OpenApiParameter('date_debut', type=str, required=False, description='Format YYYY-MM-DD'),
            OpenApiParameter('date_fin', type=str, required=False, description='Format YYYY-MM-DD'),
            OpenApiParameter('agent_id', type=int, required=False),
            OpenApiParameter('region', type=str, required=False),
        ],
    )
    def get(self, request):
        date_debut = request.query_params.get('date_debut')
        date_fin = request.query_params.get('date_fin')
        agent_id = request.query_params.get('agent_id')
        region = request.query_params.get('region')

        is_agent = request.user.role == 'AGENT'
        clients_total = CustomUser.objects.filter(role='CLIENT').count()

        credits_qs = CreditRequest.objects.all()
        schedules_qs = RepaymentSchedule.objects.all()
        policies_qs = InsurancePolicy.objects.all()

        # Agents see only their assigned credits and related data
        if is_agent:
            credits_qs = credits_qs.filter(agent=request.user)
            schedules_qs = schedules_qs.filter(credit__agent=request.user)
            policies_qs = policies_qs.filter(client__in=credits_qs.values('client'))

        if date_debut:
            credits_qs = credits_qs.filter(date_soumission__date__gte=date_debut)
        if date_fin:
            credits_qs = credits_qs.filter(date_soumission__date__lte=date_fin)
        if agent_id:
            credits_qs = credits_qs.filter(agent_id=agent_id)
        if region:
            credits_qs = credits_qs.filter(client__region__icontains=region)

        credits_total = credits_qs.count()
        credits_par_statut = {
            statut[0]: credits_qs.filter(statut=statut[0]).count()
            for statut in CreditStatus.choices
        }
        montant_total_decaisse = credits_qs.filter(
            statut=CreditStatus.DECAISSEE
        ).aggregate(total=Sum('montant_demande'))['total'] or 0

        total_du = schedules_qs.aggregate(total=Sum('montant_du'))['total'] or 0
        total_paye = Payment.objects.aggregate(total=Sum('montant_paye'))['total'] or 0
        taux_recouvrement = round((total_paye / total_du) * 100, 2) if total_du > 0 else 0.0

        today = timezone.now().date()
        retards_qs = schedules_qs.filter(
            statut__in=[RepaymentSchedule.Status.EN_ATTENTE, RepaymentSchedule.Status.EN_RETARD],
            date_echeance__lt=today,
        )
        echeances_en_retard = retards_qs.count()
        montant_retard_total = retards_qs.aggregate(total=Sum('montant_du'))['total'] or 0

        polices_actives = policies_qs.filter(statut=PolicyStatus.ACTIVE).count()
        j15 = today + timedelta(days=15)
        expirant_dans_15j = policies_qs.filter(
            statut=PolicyStatus.ACTIVE,
            date_fin__lte=j15,
            date_fin__gte=today,
        ).count()

        conversations_ouvertes = Conversation.objects.exclude(
            statut=ConversationStatus.FERMEE
        ).count()
        conversations_non_assignees = Conversation.objects.filter(
            agent__isnull=True,
        ).exclude(statut=ConversationStatus.FERMEE).count()

        return Response({
            'clients_total': clients_total,
            'credits': {
                'total': credits_total,
                'par_statut': credits_par_statut,
                'taux_recouvrement': taux_recouvrement,
                'montant_total_decaisse': montant_total_decaisse,
            },
            'remboursements': {
                'echeances_en_retard': echeances_en_retard,
                'montant_retard_total': montant_retard_total,
            },
            'assurances': {
                'polices_actives': polices_actives,
                'expirant_dans_15j': expirant_dans_15j,
            },
            'support': {
                'conversations_ouvertes': conversations_ouvertes,
                'conversations_non_assignees': conversations_non_assignees,
            },
            'filtres_disponibles': ['date_debut', 'date_fin', 'agent_id', 'region'],
        })
