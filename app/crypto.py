"""Encryption / decryption stubs for device ↔ EdgeCloud communication.

Two anticipated schemes:
  1. TLS/SSL — end-to-end transport-layer encryption (MQTT over TLS).
  2. AES    — application-layer payload encryption, typically with a
              pre-shared key burned into ESP32 hardware (e.g. via eFuse).

All functions below are intentional no-ops that pass data through unchanged.
Implement the actual cryptographic logic when the transport security strategy
is finalized.
"""

from __future__ import annotations


# ── TLS / SSL (transport layer) ──────────────────────────────────────

def configure_tls(mqtt_client, **kwargs) -> None:
    """Configure TLS context on the MQTT client for encrypted transport.

    TODO: Implement TLS setup — call ``mqtt_client.tls_set()`` with:
      - ca_certs:   path to CA certificate
      - certfile:   path to client certificate  (mutual-TLS)
      - keyfile:    path to client private key   (mutual-TLS)
      - tls_version / ciphers as needed
    """
    pass


# ── AES (application-layer payload encryption) ──────────────────────

def decrypt_payload(data: bytes, device_id: str | None = None) -> bytes:
    """Decrypt an incoming MQTT payload from a device.

    TODO: Implement AES-128/256 decryption.  Likely steps:
      - Look up the pre-shared key for *device_id*
        (key may be per-device or global, depending on provisioning)
      - Extract IV / nonce from the first N bytes of *data*
      - Decrypt remainder with AES-CBC or AES-GCM
      - Return plaintext bytes
    """
    return data


def encrypt_payload(data: bytes, device_id: str | None = None) -> bytes:
    """Encrypt an outgoing MQTT payload destined for a device.

    TODO: Implement AES-128/256 encryption.  Likely steps:
      - Look up the pre-shared key for *device_id*
      - Generate a random IV / nonce
      - Encrypt with AES-CBC or AES-GCM
      - Return IV + ciphertext bytes
    """
    return data
