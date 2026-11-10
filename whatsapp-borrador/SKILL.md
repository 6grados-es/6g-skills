---
name: whatsapp-borrador
description: Deja un mensaje de WhatsApp escrito y abierto en la aplicación de WhatsApp de tu ordenador (Windows o Mac), con el destinatario y el texto ya puestos, para que tú lo revises y pulses enviar. Nunca envía nada por su cuenta y no lee tus chats. Úsala siempre que digas «ábreme un WhatsApp para X», «prepárale un mensaje a X», «contesta a este cliente por WhatsApp», «escríbele a X por WhatsApp» o «déjame el mensaje listo», aunque no menciones la palabra borrador. Sirve para responder a clientes con el tono de tu despacho. No es para leer conversaciones ni para mandar mensajes a varias personas a la vez.
---

# WhatsApp en borrador

Esta skill prepara un mensaje de WhatsApp y lo deja abierto en la aplicación, con la persona y el texto ya puestos. **El envío lo pulsas tú.** La razón es sencilla: un mensaje a un cliente sale con tu nombre, y lo que sale hacia fuera solo debe salir cuando una persona lo ha visto.

## Cómo se usa

1. **Averigua a quién va y qué se dice.** Si te dan el texto, úsalo tal cual. Si piden que lo redactes, escribe uno corto, claro y en el tono de la persona, y di en el chat que lo has redactado tú.
2. **Consigue el número.** Solo dígitos, con el prefijo del país y sin `+` ni espacios (España: `34` y el número, por ejemplo `34600111222`). Si no lo tienes, ábrelo sin número: la aplicación enseña el mensaje y dejas elegir el contacto.
3. **Codifica el texto** para que las tildes, las comas y los saltos de línea no rompan el enlace:

```python
import urllib.parse
texto = "Hola Marta, te confirmo la cita del jueves a las 10:00."
print("whatsapp://send?phone=34600111222&text=" + urllib.parse.quote(texto, safe=""))
```

   Sin número, el enlace es `whatsapp://send?text=` seguido del texto codificado.
4. **Ábrelo en la aplicación de WhatsApp**, no en WhatsApp Web:
   - **Windows:** `start "" "whatsapp://send?phone=…&text=…"` (en PowerShell: `Start-Process "whatsapp://send?phone=…&text=…"`).
   - **Mac:** `open -a WhatsApp "whatsapp://send?phone=…&text=…"`.
5. **Dile a la persona qué se ha abierto:** a quién va, el texto exacto y qué has supuesto (destinatario, redacción). Y recuérdale que el envío es suyo.

## Qué no hace

- **No envía.** Aunque te digan «mándaselo», se interpreta como «déjalo listo». Si alguien quiere que salga solo, es otra decisión y se habla antes.
- **No lee conversaciones.** No necesita ninguna sesión de WhatsApp vinculada, y por eso funciona al instante en cualquier ordenador.
- **No escribe a varias personas a la vez**, ni a grupos.

## Cosas que conviene saber

- Los mensajes muy largos (más de unos 2.000 caracteres ya codificados) pueden cortarse. Divídelos en dos o pásaselos a la persona en el chat para que los pegue.
- Sin emojis, salvo que los pida quien manda el mensaje.
- Para mensajes a clientes, que sean breves y concretos: qué puede hacer ahora y qué viene después. No se cuentan problemas internos.
- Si hay dos contactos posibles para el mismo nombre, pregunta cuál antes de abrir nada.
