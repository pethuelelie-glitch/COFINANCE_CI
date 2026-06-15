from django.db import models
from django.conf import settings

class NotificationType(models.TextChoices):
    CREDIT_STATUT = 'CREDIT_STATUT', 'Statut Crédit'
    REMBOURSEMENT = 'REMBOURSEMENT', 'Remboursement'
    ASSURANCE_SOUSCRIPTION = 'ASSURANCE_SOUSCRIPTION', 'Souscription Assurance'
    ASSURANCE_EXPIRATION = 'ASSURANCE_EXPIRATION', 'Expiration Assurance'
    SUPPORT_MESSAGE = 'SUPPORT_MESSAGE', 'Message Support'

class Notification(models.Model):
    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    type_notif = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        verbose_name='Type'
    )
    titre = models.CharField(max_length=255)
    message = models.TextField()
    lu = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.type_notif} pour {self.destinataire.email} - Lu: {self.lu}"
