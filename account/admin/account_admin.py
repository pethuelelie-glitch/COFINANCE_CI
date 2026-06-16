from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html

from account.models import CustomUser


_ROLE_COLORS = {
    'CLIENT': 'blue',
    'AGENT':  'green',
    'ADMIN':  'purple',
}
_ROLE_LABELS = {
    'CLIENT': 'Client',
    'AGENT':  'Agent',
    'ADMIN':  'Administrateur',
}


def action_activer(modeladmin, request, queryset):
    queryset.update(is_active=True)
action_activer.short_description = "Activer les comptes sélectionnés"

def action_desactiver(modeladmin, request, queryset):
    queryset.exclude(pk=request.user.pk).update(is_active=False)
action_desactiver.short_description = "Désactiver les comptes sélectionnés"


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display   = ['email', 'nom_complet', 'role_badge', 'ville',
                      'phone', 'actif_badge', 'created_at']
    list_filter    = ['role', 'is_active', 'ville', 'region']
    search_fields  = ['email', 'first_name', 'last_name', 'phone']
    ordering       = ['-created_at']
    actions        = [action_activer, action_desactiver]
    list_per_page  = 30
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'last_login', 'photo_apercu']

    # Colonnes de base de UserAdmin pas adaptées (username-centric) → override complet
    fieldsets = (
        ('Compte', {
            'fields': ('username', 'email', 'password')
        }),
        ('Identité', {
            'fields': ('first_name', 'last_name', 'date_naissance',
                       'photo_profil', 'photo_apercu')
        }),
        ('Coordonnées', {
            'fields': ('phone', 'adresse', 'ville', 'region')
        }),
        ('Rôle & accès', {
            'fields': ('role', 'is_active', 'is_staff', 'is_superuser',
                       'groups', 'user_permissions')
        }),
        ('Historique', {
            'fields': ('created_at', 'last_login'),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = (
        ('Création compte', {
            'fields': ('username', 'email', 'password1', 'password2')
        }),
        ('Informations COFINANCE CI', {
            'fields': ('first_name', 'last_name', 'role', 'phone', 'ville')
        }),
    )

    def nom_complet(self, obj):
        full = f"{obj.first_name} {obj.last_name}".strip()
        return full or format_html('<span style="color:#9ca3af">—</span>')
    nom_complet.short_description = "Nom complet"
    nom_complet.admin_order_field = 'first_name'

    def role_badge(self, obj):
        color = _ROLE_COLORS.get(obj.role, 'gray')
        label = _ROLE_LABELS.get(obj.role, obj.role or '—')
        return format_html(
            '<span class="badge badge-{}">{}</span>', color, label
        )
    role_badge.short_description = "Rôle"
    role_badge.admin_order_field = 'role'

    def actif_badge(self, obj):
        if obj.is_active:
            return format_html('<span class="badge badge-green">Actif</span>')
        return format_html('<span class="badge badge-red">Inactif</span>')
    actif_badge.short_description = "Statut"
    actif_badge.admin_order_field = 'is_active'

    def photo_apercu(self, obj):
        if obj.photo_profil:
            return format_html(
                '<img src="{}" style="width:64px;height:64px;object-fit:cover;'
                'border-radius:50%;border:2px solid #e5e7eb">',
                obj.photo_profil.url
            )
        return format_html(
            '<div style="width:64px;height:64px;border-radius:50%;background:#f0f4ff;'
            'display:flex;align-items:center;justify-content:center;color:#93c5fd;font-size:1.5rem">👤</div>'
        )
    photo_apercu.short_description = "Photo"
