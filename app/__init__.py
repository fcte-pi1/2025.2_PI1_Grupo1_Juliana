"""Pacote principal da aplicação.
Garante que 'app' seja tratado como pacote para evitar alertas de import em IDE/Pylance.
"""
from . import config, controller, model, service  # noqa: F401
