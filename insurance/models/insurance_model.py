from django.db import models
from django.conf import settings

class ProductType(models.TextChoices):
    VIE = 'VIE', 'Assurance Vie'
    DECES_INVALIDITE = 'DECES_INVALIDITE', 'Décès et Invalidité'

class InsuranceProduct(models.Model):
    nom = models.CharField(max_length=100)
    description = models.TextField()
    prime_mensuelle = models.IntegerField(verbose_name='Prime Mensuelle (FCFA)')
    couverture_max = models.IntegerField(verbose_name='Couverture Maximale (FCFA)')
    type_produit = models.CharField(
        max_length=50,
        choices=ProductType.choices
    )

    def __str__(self):
        return f"{self.nom} ({self.prime_mensuelle} FCFA/mois)"

class PolicyStatus(models.TextChoices):
    ACTIVE = 'ACTIVE', 'Active'
    EXPIREE = 'EXPIREE', 'Expirée'
    RESILIEE = 'RESILIEE', 'Résiliée'

class InsurancePolicy(models.Model):
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='insurance_policies',
        limit_choices_to={'role': 'CLIENT'}
    )
    produit = models.ForeignKey(
        InsuranceProduct,
        on_delete=models.CASCADE
    )
    date_debut = models.DateField()
    date_fin = models.DateField()
    statut = models.CharField(
        max_length=20,
        choices=PolicyStatus.choices,
        default=PolicyStatus.ACTIVE
    )

    class Meta:
        ordering = ['-date_debut']

    def __str__(self):
        return f"Police {self.produit.nom} - {self.client.email}"
