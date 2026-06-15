from rest_framework import serializers
from .models import InsuranceProduct, InsurancePolicy

class InsuranceProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = InsuranceProduct
        fields = '__all__'

class InsurancePolicySerializer(serializers.ModelSerializer):
    produit_details = InsuranceProductSerializer(source='produit', read_only=True)
    client_name = serializers.CharField(source='client.get_full_name', read_only=True)

    class Meta:
        model = InsurancePolicy
        fields = ['id', 'client', 'client_name', 'produit', 'produit_details', 'date_debut', 'date_fin', 'statut']
        read_only_fields = ['client', 'statut']

    def validate(self, attrs):
        if attrs['date_fin'] <= attrs['date_debut']:
            raise serializers.ValidationError("La date de fin doit être postérieure à la date de début.")
        return attrs
