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
