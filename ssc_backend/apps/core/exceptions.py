import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        logger.exception(
            "Unhandled exception in %s",
            context.get('view').__class__.__name__,
            exc_info=exc,
        )
        return Response(
            {"detail": "An internal server error occurred. Please try again later."},
            status=500,
        )

    if hasattr(response, 'data'):
        if 'non_field_errors' in response.data:
            pass

    return response