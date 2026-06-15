import json

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from chat.models import Conversation, Message, ConversationStatus


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        user = self.scope['user']

        if not user.is_authenticated:
            await self.close()
            return

        allowed = await self.user_can_access(user.id)
        if not allowed:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        data = json.loads(text_data)
        msg_type = data.get('type', 'message')
        user = self.scope['user']

        if msg_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_typing',
                    'user_id': user.id,
                    'user_name': user.get_full_name(),
                    'is_typing': data.get('is_typing', True),
                },
            )
            return

        if msg_type == 'read':
            await self.mark_messages_read(user.id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_read',
                    'user_id': user.id,
                },
            )
            return

        content = data.get('content', '').strip()
        if not content:
            return

        message = await self.save_message(user.id, content)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': message['id'],
                    'auteur_id': message['auteur_id'],
                    'auteur_name': message['auteur_name'],
                    'contenu': message['contenu'],
                    'timestamp': message['timestamp'],
                },
            },
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
        }))

    async def chat_typing(self, event):
        if event['user_id'] == self.scope['user'].id:
            return
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'user_name': event['user_name'],
            'is_typing': event['is_typing'],
        }))

    async def chat_read(self, event):
        await self.send(text_data=json.dumps({
            'type': 'read',
            'user_id': event['user_id'],
        }))

    @database_sync_to_async
    def user_can_access(self, user_id):
        try:
            conversation = Conversation.objects.get(pk=self.conversation_id)
        except Conversation.DoesNotExist:
            return False

        user = self.scope['user']
        if user.role == 'ADMIN':
            return True
        if user.role == 'AGENT':
            return conversation.agent_id in (None, user.id)
        return conversation.client_id == user.id

    @database_sync_to_async
    def save_message(self, user_id, content):
        conversation = Conversation.objects.get(pk=self.conversation_id)
        if conversation.statut == ConversationStatus.OUVERTE and self.scope['user'].role == 'AGENT':
            conversation.statut = ConversationStatus.EN_COURS
            conversation.agent = self.scope['user']
            conversation.save()

        msg = Message.objects.create(
            conversation=conversation,
            auteur_id=user_id,
            contenu=content,
        )
        conversation.updated_at = timezone.now()
        conversation.save(update_fields=['updated_at', 'statut', 'agent'])

        return {
            'id': msg.id,
            'auteur_id': msg.auteur_id,
            'auteur_name': msg.auteur.get_full_name(),
            'contenu': msg.contenu,
            'timestamp': msg.timestamp.isoformat(),
        }

    @database_sync_to_async
    def mark_messages_read(self, user_id):
        Message.objects.filter(
            conversation_id=self.conversation_id,
        ).exclude(auteur_id=user_id).update(lu=True)
