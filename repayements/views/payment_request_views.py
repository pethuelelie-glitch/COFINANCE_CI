from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, OpenApiParameter

from account.permission import IsAgentOrAdmin
from repayements.models import Payment, PaymentRequest
from repayements.serializers import (
    PaymentRequestCreateSerializer,
    PaymentRequestSerializer,
    ValidatePaymentRequestSerializer,
)
from notification.services import NotificationService
from notification.models import NotificationType


class PaymentRequestCreateView(APIView):
    """Client initie une demande de paiement pour une de ses échéances."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Demandes de paiement'],
        summary="Initier une demande de paiement",
        description=(
            "Le client soumet une preuve de paiement (référence MTN MoMo, Orange Money…). "
            "L'agent valide ou rejette la demande."
        ),
        request=PaymentRequestCreateSerializer,
        responses={201: PaymentRequestSerializer},
    )
    def post(self, request):
        if request.user.role != 'CLIENT':
            return Response(
                {'error': 'Seuls les clients peuvent initier des demandes de paiement.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = PaymentRequestCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        pr = serializer.save()

        # Notifier tous les agents — simplifié : notif dans un vrai projet passerait par WebSocket
        from account.models import CustomUser
        agents = CustomUser.objects.filter(role__in=['AGENT', 'ADMIN'], is_active=True)
        for agent in agents:
            NotificationService.create(
                destinataire=agent,
                type_notif=NotificationType.REMBOURSEMENT,
                titre='Nouvelle demande de paiement',
                message=(
                    f'{pr.client.get_full_name()} a soumis une demande de {pr.montant} FCFA '
                    f'pour l\'échéance n°{pr.echeance.numero_echeance} '
                    f'(crédit #{pr.echeance.credit.id}).'
                ),
            )

        return Response(PaymentRequestSerializer(pr).data, status=status.HTTP_201_CREATED)


class PaymentRequestListView(APIView):
    """
    Client : liste ses propres demandes.
    Agent/Admin : liste toutes les demandes (filtre par ?statut=EN_ATTENTE).
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Demandes de paiement'],
        summary="Lister les demandes de paiement",
        parameters=[
            OpenApiParameter('statut', str, description='Filtrer par statut : EN_ATTENTE, VALIDEE, REJETEE'),
        ],
        responses={200: PaymentRequestSerializer(many=True)},
    )
    def get(self, request):
        if request.user.role == 'CLIENT':
            qs = PaymentRequest.objects.filter(client=request.user).select_related(
                'echeance', 'echeance__credit', 'agent_validateur',
            )
        else:
            qs = PaymentRequest.objects.select_related(
                'client', 'echeance', 'echeance__credit', 'agent_validateur',
            )
            statut = request.query_params.get('statut')
            if statut:
                qs = qs.filter(statut=statut)

        return Response(PaymentRequestSerializer(qs, many=True).data)


class PaymentRequestDetailView(APIView):
    """Détail d'une demande de paiement (client propriétaire ou agent/admin)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Demandes de paiement'],
        summary="Détail d'une demande de paiement",
        responses={200: PaymentRequestSerializer},
    )
    def get(self, request, pk):
        pr = get_object_or_404(PaymentRequest, pk=pk)
        if request.user.role == 'CLIENT' and pr.client != request.user:
            return Response({'error': 'Accès refusé.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(PaymentRequestSerializer(pr).data)


class PaymentRequestValidateView(APIView):
    """Agent valide une demande → crée le paiement et marque l'échéance PAYEE."""
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Demandes de paiement'],
        summary="Valider une demande de paiement",
        request=ValidatePaymentRequestSerializer,
        responses={200: PaymentRequestSerializer},
    )
    def post(self, request, pk):
        pr = get_object_or_404(PaymentRequest, pk=pk)

        if pr.statut != PaymentRequest.Status.EN_ATTENTE:
            return Response(
                {'error': f'Cette demande est déjà {pr.get_statut_display().lower()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ValidatePaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Créer le paiement réel
        payment = Payment.objects.create(
            echeance=pr.echeance,
            montant_paye=pr.montant,
            agent=request.user,
        )

        pr.statut           = PaymentRequest.Status.VALIDEE
        pr.agent_validateur = request.user
        pr.note_agent       = serializer.validated_data.get('note_agent', '')
        pr.payment          = payment
        pr.save()

        # Notifier le client
        NotificationService.create(
            destinataire=pr.client,
            type_notif=NotificationType.REMBOURSEMENT,
            titre='Paiement validé ✓',
            message=(
                f'Votre paiement de {pr.montant} FCFA pour l\'échéance '
                f'n°{pr.echeance.numero_echeance} a été validé par {request.user.get_full_name()}.'
            ),
        )

        return Response(PaymentRequestSerializer(pr).data)


class PaymentRequestRejectView(APIView):
    """Agent rejette une demande de paiement."""
    permission_classes = [IsAuthenticated, IsAgentOrAdmin]

    @extend_schema(
        tags=['Demandes de paiement'],
        summary="Rejeter une demande de paiement",
        request=ValidatePaymentRequestSerializer,
        responses={200: PaymentRequestSerializer},
    )
    def post(self, request, pk):
        pr = get_object_or_404(PaymentRequest, pk=pk)

        if pr.statut != PaymentRequest.Status.EN_ATTENTE:
            return Response(
                {'error': f'Cette demande est déjà {pr.get_statut_display().lower()}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ValidatePaymentRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pr.statut           = PaymentRequest.Status.REJETEE
        pr.agent_validateur = request.user
        pr.note_agent       = serializer.validated_data.get('note_agent', 'Demande rejetée.')
        pr.save()

        # Notifier le client
        NotificationService.create(
            destinataire=pr.client,
            type_notif=NotificationType.REMBOURSEMENT,
            titre='Demande de paiement rejetée',
            message=(
                f'Votre demande de {pr.montant} FCFA pour l\'échéance '
                f'n°{pr.echeance.numero_echeance} a été rejetée. '
                f'Motif : {pr.note_agent}'
            ),
        )

        return Response(PaymentRequestSerializer(pr).data)