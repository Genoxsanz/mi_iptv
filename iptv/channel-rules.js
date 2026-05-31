const CHANNEL_RULES = [
  /*
    Este archivo es para corregir canales sin tocar la lista original.

    EJEMPLOS:

    Cambiar nombre:
    {
      matchName: "Tigo Sports+",
      renameTo: "SNT",
      hide: false
    },

    Ocultar canal:
    {
      matchName: "Canal malo",
      hide: true
    },

    Cambiar logo:
    {
      matchName: "SNT",
      logo: "https://url-del-logo.png"
    },

    Ocultar por URL:
    {
      matchUrlContains: "servidor-malo.com",
      hide: true
    },

    Forzar canal como Paraguay:
    {
      matchNameContains: "Nombre del canal",
      forceParaguay: true
    }
  */

  {
    matchName: "Tigo Sports+",
    renameTo: "Tigo Sports+ / revisar señal",
    hide: false
  }
];