from rest_framework import serializers
from .models import Payment, PaymentRequest
from credit.models import RepaymentSchedule


class PaymentSerializer(serializers.ModelSerializer):
    agent_name  = serializers.CharField(source='agent.get_full_name', read_only=True)
    client_name = serializers.CharField(source='echeance.credit.client.get_full_name', read_only=True)
    credit_id   = serializers.IntegerField(source='echeance.credit.id', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'echeance', 'montant_paye', 'date_paiement',
            'agent', 'agent_name', 'penalites', 'interets', 'client_name', 'credit_id',
        ]
        read_only_fields = ['date_paiement', 'agent', 'penalites']


# ── PaymentRequest ─────────────────────────────────────────────────────────


class PaymentRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentRequest
        fields = ['echeance', 'montant', 'mode_paiement', 'reference_transaction', 'note_client']

    def validate_echeance(self, echeance):
        client = self.context['request'].user
        if echeance.credit.client != client:
            raise serializers.ValidationError("Cette échéance ne vous appartient pas.")
        if echeance.statut == RepaymentSchedule.Status.PAYEE:
            raise serializers.ValidationError("Cette échéance est déjà payée.")
        if PaymentRequest.objects.filter(echeance=echeance, statut='EN_ATTENTE').exists():
            raise serializers.ValidationError(
                "Une demande de paiement est déjà en attente pour cette échéance."
            )
        return echeance

    def validate_montant(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value

    def create(self, validated_data):
        validated_data['client'] = self.context['request'].user
        return super().create(validated_data)


class PaymentRequestSerializer(serializers.ModelSerializer):
    echeance_info       = serializers.SerializerMethodField()
    client_email        = serializers.CharField(source='client.email', read_only=True)
    client_name         = serializers.CharField(source='client.get_full_name', read_only=True)
    agent_nom           = serializers.CharField(source='agent_validateur.get_full_name', read_only=True)
    mode_paiement_label = serializers.CharField(source='get_mode_paiement_display', read_only=True)
    statut_label        = serializers.CharField(source='get_statut_display', read_only=True)

    class Meta:
        model = PaymentRequest
        fields = [
            'id', 'echeance', 'echeance_info',
            'client', 'client_email', 'client_name',
            'montant', 'mode_paiement', 'mode_paiement_label',
            'reference_transaction', 'statut', 'statut_label',
            'note_client', 'note_agent',
            'agent_validateur', 'agent_nom',
            'payment', 'created_at', 'updated_at',
        ]

    def get_echeance_info(self, obj):
        return {
            'id':              obj.echeance.id,
            'numero':          obj.echeance.numero_echeance,
            'date_echeance':   obj.echeance.date_echeance,
            'montant_du':      obj.echeance.montant_du,
            'statut':          obj.echeance.statut,
            'credit_id':       obj.echeance.credit.id,
        }


class ValidatePaymentRequestSerializer(serializers.Serializer):
    note_agent = serializers.CharField(required=False, allow_blank=True, default='')
