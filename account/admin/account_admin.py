from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from account.models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ['email', 'first_name', 'last_name', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'ville']
    search_fields = ['email', 'first_name', 'last_name', 'phone']
    ordering = ['-created_at']

    fieldsets = UserAdmin.fieldsets + (
        ('Informations COFINANCE CI', {
            'fields': ('role', 'phone', 'adresse', 'ville', 'region', 'date_naissance', 'photo_profil')
        }),
    )

    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Informations COFINANCE CI', {
            'fields': ('email', 'role', 'phone', 'ville')
        }),
    )
