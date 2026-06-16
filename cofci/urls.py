from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.views.generic import RedirectView
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

def serve_frontend(request, path='index.html'):
    """Sert les fichiers statiques du dossier frontend/.

    Compatible DEBUG=True et DEBUG=False (via FRONTEND_DIR).
    """
    return static_serve(request, path, document_root=settings.FRONTEND_DIR)


urlpatterns = [
    # Racine → frontend (page d'accueil publique)
    path('', RedirectView.as_view(url='/app/', permanent=False), name='home'),

    # ─── Frontend ─────────────────────────────────────────────────────────────
    # Sert l'intégralité du dossier frontend/ sous /app/
    # Ex: /app/login.html, /app/assets/css/style.css, /app/logo.svg
    path('app/', serve_frontend, {'path': 'index.html'}, name='frontend-home'),
    re_path(r'^app/(?P<path>.+)$', serve_frontend, name='frontend-files'),

    # ─── Django Admin ─────────────────────────────────────────────────────────
    path('admin/', admin.site.urls),

    # ─── Documentation API ────────────────────────────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ─── Modules API ──────────────────────────────────────────────────────────
    path('api/auth/', include('account.urls')),
    path('api/credits/', include('credit.urls')),
    path('api/repayments/', include('repayements.urls')),
    path('api/insurance/', include('insurance.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/notifications/', include('notification.urls')),
    path('api/chat/', include('chat.urls')),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += staticfiles_urlpatterns()
