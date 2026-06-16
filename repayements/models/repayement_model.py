from django.db import models
from django.conf import settings
from credit.models import RepaymentSchedule
from credit.services import CreditService
from django.utils import timezone
from datetime import timedelta

class Payment(models.Model):
    echeance = models.ForeignKey(
        RepaymentSchedule,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    montant_paye = models.IntegerField(verbose_name='Montant payé (FCFA)')
    date_paiement = models.DateTimeField(auto_now_add=True)
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='processed_payments',
        limit_choices_to={'role__in': ['AGENT', 'ADMIN']}
    )
    penalites = models.IntegerField(default=0, verbose_name='Pénalités (FCFA)')
    interets = models.IntegerField(default=0, verbose_name='Intérêts (FCFA)')

    class Meta:
        ordering = ['-date_paiement']

    def __str__(self):
        return f"Paiement {self.montant_paye} FCFA - Échéance {self.echeance.id}"

    def save(self, *args, **kwargs):
        if not self.pk:
            montant_base = self.echeance.montant_du
            credit = self.echeance.credit
            duree = credit.schedules.count() or 12
            self.interets = int(montant_base * CreditService.INTERET_ANNUEL / duree)

            if timezone.now().date() > self.echeance.date_echeance:
                days_late = (timezone.now().date() - self.echeance.date_echeance).days
                weeks_late = days_late // 7
                if days_late % 7 > 0:
                    weeks_late += 1
                self.penalites = int(montant_base * 0.02 * weeks_late)

        super().save(*args, **kwargs)

        # montant_du already includes interest baked in by generate_repayment_schedule
        total_du = self.echeance.montant_du + self.penalites
        if self.montant_paye >= total_du:
            self.echeance.statut = RepaymentSchedule.Status.PAYEE
            self.echeance.save()


class PaymentRequest(models.Model):
    """Demande de paiement initiée par le client, validée ou rejetée par l'agent."""

    class Status(models.TextChoices):
        EN_ATTENTE = 'EN_ATTENTE', 'En attente'
        VALIDEE    = 'VALIDEE',    'Validée'
        REJETEE    = 'REJETEE',    'Rejetée'

    class ModePayment(models.TextChoices):
        MOBILE_MONEY = 'MOBILE_MONEY', 'Mobile Money (MTN / Orange / Wave)'
        ESPECES      = 'ESPECES',      'Espèces en agence'
        VIREMENT     = 'VIREMENT',     'Virement bancaire'

    echeance = models.ForeignKey(
        RepaymentSchedule,
        on_delete=models.CASCADE,
        related_name='payment_requests',
        verbose_name='Échéance concernée',
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payment_requests',
        limit_choices_to={'role': 'CLIENT'},
        verbose_name='Client',
    )
    montant = models.IntegerField(verbose_name='Montant envoyé (FCFA)')
    mode_paiement = models.CharField(
        max_length=20,
        choices=ModePayment.choices,
        verbose_name='Mode de paiement',
    )
    reference_transaction = models.CharField(
        max_length=120,
        blank=True,
        verbose_name='Référence / ID transaction',
    )
    statut = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.EN_ATTENTE,
        verbose_name='Statut',
    )
    note_client = models.TextField(blank=True, verbose_name='Note du client')
    note_agent  = models.TextField(blank=True, verbose_name='Note de l\'agent')
    agent_validateur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='validated_payment_requests',
        limit_choices_to={'role__in': ['AGENT', 'ADMIN']},
        verbose_name='Agent validateur',
    )
    payment = models.OneToOneField(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='source_request',
        verbose_name='Paiement créé',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Demande de paiement'
        verbose_name_plural = 'Demandes de paiement'

    def __str__(self):
        return f"Demande #{self.id} — {self.montant} FCFA — {self.get_statut_display()}"
