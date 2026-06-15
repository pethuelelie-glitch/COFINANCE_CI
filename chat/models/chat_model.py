from django.db import models
from django.conf import settings

class ConversationStatus(models.TextChoices):
    OUVERTE = 'OUVERTE', 'Ouverte'
    EN_COURS = 'EN_COURS', 'En cours'
    FERMEE = 'FERMEE', 'Fermée'

class Conversation(models.Model):
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversations_client',
        limit_choices_to={'role': 'CLIENT'}
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conversations_agent',
        limit_choices_to={'role__in': ['AGENT', 'ADMIN']}
    )
    statut = models.CharField(
        max_length=20,
        choices=ConversationStatus.choices,
        default=ConversationStatus.OUVERTE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"Conversation #{self.id} - {self.client.email}"

class Message(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages'
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE
    )
    contenu = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    lu = models.BooleanField(default=False)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"Msg from {self.auteur.email} at {self.timestamp}"
