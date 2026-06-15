from rest_framework import serializers
from .models import Conversation, Message

class MessageSerializer(serializers.ModelSerializer):
    auteur_name = serializers.CharField(source='auteur.get_full_name', read_only=True)
    
    class Meta:
        model = Message
        fields = ['id', 'conversation', 'auteur', 'auteur_name', 'contenu', 'timestamp', 'lu']
        read_only_fields = ['auteur', 'timestamp', 'lu', 'conversation']

class ConversationSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.get_full_name', read_only=True)
    agent_name  = serializers.CharField(source='agent.get_full_name',  read_only=True)
    last_message = serializers.SerializerMethodField()
    unread       = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'client', 'client_name', 'agent', 'agent_name',
                  'statut', 'created_at', 'updated_at', 'last_message', 'unread']
        read_only_fields = ['client', 'agent', 'statut', 'created_at', 'updated_at']

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-timestamp').first()
        return msg.contenu if msg else None

    def get_unread(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.messages.exclude(auteur=request.user).filter(lu=False).count()
