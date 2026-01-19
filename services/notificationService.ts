
export const notificationService = {
  async requestPermission(): Promise<boolean> {
    const NotificationAPI = (window as any).Notification;
    if (!NotificationAPI) {
      console.warn("Este navegador não suporta notificações.");
      return false;
    }

    try {
      const permission = await NotificationAPI.requestPermission();
      return permission === "granted";
    } catch (e) {
      console.error("Erro ao solicitar permissão de notificação:", e);
      return false;
    }
  },

  async send(title: string, body: string, tag?: string) {
    const NotificationAPI = (window as any).Notification;
    if (NotificationAPI && NotificationAPI.permission === "granted") {
      const options = {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png',
        tag: tag || 'nexus-reminder', // Evita duplicatas se disparadas juntas
        badge: 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png'
      };
      
      try {
        return new NotificationAPI(`Nexus: ${title}`, options);
      } catch (e) {
        console.warn("Falha ao disparar notificação:", e);
        return null;
      }
    }
    return null;
  },

  getPermissionStatus(): string {
    const NotificationAPI = (window as any).Notification;
    if (!NotificationAPI) return 'denied';
    try {
      return NotificationAPI.permission;
    } catch (e) {
      return 'denied';
    }
  }
};
