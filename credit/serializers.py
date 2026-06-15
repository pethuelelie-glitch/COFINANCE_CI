from rest_framework import serializers
from .models import CreditRequest, RepaymentSchedule

class RepaymentScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RepaymentSchedule
        fields = '__all__'

class CreditRequestSerializer(serializers.ModelSerializer):
    schedules = RepaymentScheduleSerializer(many=True, read_only=True)
    client_name = serializers.CharField(source='client.get_full_name', read_only=True)
    agent_name = serializers.CharField(source='agent.get_full_name', read_only=True)

    class Meta:
        model = CreditRequest
        fields = [
            'id', 'client', 'client_name', 'agent', 'agent_name',
            'montant_demande', 'duree_mois', 'taux_interet',
            'motif', 'description', 'statut', 'score_eligibilite',
            'pieces_justificatives', 'date_soumission', 'date_decision',
            'schedules'
        ]
        read_only_fields = ['client', 'agent', 'statut', 'score_eligibilite', 'date_soumission', 'date_decision']
