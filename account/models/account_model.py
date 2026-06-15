from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserRole(models.TextChoices):
    CLIENT = 'CLIENT', 'Client'
    AGENT = 'AGENT', 'Agent'
    ADMIN = 'ADMIN', 'Administrateur'


class CustomUserManager(BaseUserManager):
    """Manager personnalisé pour le modèle CustomUser."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire.")
        email = self.normalize_email(email)
        extra_fields.setdefault('username', email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', UserRole.ADMIN)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Le superuser doit avoir is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Le superuser doit avoir is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class CustomUser(AbstractUser):
    """
    Utilisateur personnalisé COFINANCE CI.
    Le champ email est utilisé comme identifiant principal (USERNAME_FIELD).
    """

    # Rôle dans la plateforme
    role = models.CharField(
        max_length=10,
        choices=UserRole.choices,
        default=UserRole.CLIENT,
        verbose_name='Rôle',
    )

    # Informations de contact
    email = models.EmailField(unique=True, verbose_name='Adresse email')
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        verbose_name='Téléphone',
    )

    # Informations personnelles
    adresse = models.TextField(blank=True, null=True, verbose_name='Adresse')
    ville = models.CharField(max_length=100, blank=True, null=True, verbose_name='Ville')
    region = models.CharField(max_length=100, blank=True, null=True, verbose_name='Région')
    date_naissance = models.DateField(blank=True, null=True, verbose_name='Date de naissance')
    photo_profil = models.ImageField(
        upload_to='profils/',
        blank=True,
        null=True,
        verbose_name='Photo de profil',
    )

    # Métadonnées
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Date de création')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Dernière mise à jour')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    objects = CustomUserManager()

    class Meta:
        verbose_name = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_full_name()} ({self.email}) — {self.role}"

    @property
    def is_client(self):
        return self.role == UserRole.CLIENT

    @property
    def is_agent(self):
        return self.role == UserRole.AGENT

    @property
    def is_admin(self):
        return self.role == UserRole.ADMIN

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email
