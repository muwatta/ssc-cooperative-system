

from os import path
from xml.etree.ElementInclude import include


path("api/v1/reports/", include("apps.reports.urls")),