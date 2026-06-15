from django.db import models
from django.conf import settings

class CreditStatus(models.TextChoices):
    SOUMISE = 'SOUMISE', 'Soumise'
    EN_ANALYSE = 'EN_ANALYSE', 'En Analyse'
    APPROUVEE = 'APPROUVEE', 'Approuvée'
    DECAISSEE = 'DECAISSEE', 'Décaissée'
    REJETEE = 'REJETEE', 'Rejetée'

class CreditRequest(models.Model):
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_requests',
        limit_choices_to={'role': 'CLIENT'}
    )
    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_credits',
        limit_choices_to={'role': 'AGENT'}
    )
    montant_demande = models.IntegerField(verbose_name='Montant demandé (FCFA)')
    duree_mois = models.IntegerField(default=12, verbose_name='Durée (mois)')
    taux_interet = models.FloatField(default=12.0, verbose_name="Taux d'intérêt annuel (%)")
    motif = models.TextField(verbose_name='Motif du prêt')
    description = models.TextField(blank=True, default='', verbose_name='Description complémentaire')
    statut = models.CharField(
        max_length=20,
        choices=CreditStatus.choices,
        default=CreditStatus.SOUMISE,
        verbose_name='Statut'
    )
    score_eligibilite = models.FloatField(default=0.0, verbose_name="Score d'éligibilité")
    pieces_justificatives = models.FileField(upload_to='credits/documents/', blank=True, null=True)
    
    date_soumission = models.DateTimeField(auto_now_add=True)
    date_decision = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date_soumission']

    def __str__(self):
        return f"Crédit #{self.id} - {self.client} - {self.montant_demande} FCFA"

    def calculate_score(self):
        from credit.services import CreditService
        self.score_eligibilite = CreditService.calculate_eligibility_score(self)
        self.save(update_fields=['score_eligibilite'])


class RepaymentSchedule(models.Model):
    class Status(models.TextChoices):
        EN_ATTENTE = 'EN_ATTENTE', 'En attente'
        PAYEE = 'PAYEE', 'Payée'
        EN_RETARD = 'EN_RETARD', 'En retard'

    credit = models.ForeignKey(
        CreditRequest,
        on_delete=models.CASCADE,
        related_name='schedules'
    )
    numero_echeance = models.IntegerField()
    date_echeance = models.DateField()
    montant_du = models.IntegerField(verbose_name='Montant dû (FCFA)')
    statut = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.EN_ATTENTE
    )

    class Meta:
        ordering = ['date_echeance']

    def __str__(self):
        return f"Échéance {self.numero_echeance} - Crédit #{self.credit.id}"
