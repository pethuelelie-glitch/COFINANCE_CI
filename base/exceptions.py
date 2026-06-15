from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """Gestionnaire d'exceptions DRF avec réponses JSON uniformes."""
    response = exception_handler(exc, context)

    if response is not None:
        error_payload = {
            'success': False,
            'error': response.data,
        }
        if isinstance(response.data, dict) and 'detail' in response.data:
            error_payload['message'] = str(response.data['detail'])
        response.data = error_payload
        return response

    return Response(
        {
            'success': False,
            'message': 'Une erreur interne est survenue.',
            'error': str(exc),
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
