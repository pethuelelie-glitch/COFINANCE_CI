from rest_framework import serializers
from .models import Payment

class PaymentSerializer(serializers.ModelSerializer):
    agent_name = serializers.CharField(source='agent.get_full_name', read_only=True)
    client_name = serializers.CharField(source='echeance.credit.client.get_full_name', read_only=True)
    credit_id = serializers.IntegerField(source='echeance.credit.id', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'echeance', 'montant_paye', 'date_paiement',
            'agent', 'agent_name', 'penalites', 'interets', 'client_name', 'credit_id'
        ]
        read_only_fields = ['date_paiement', 'agent', 'penalites']
