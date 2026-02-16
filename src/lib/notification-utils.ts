export const isNotificationSupported = () => {
    return typeof window !== "undefined" && "Notification" in window;
};

export const getNotificationPermission = () => {
    if (!isNotificationSupported()) return "denied";
    return Notification.permission;
};

export const requestNotificationPermission = async () => {
    if (!isNotificationSupported()) return "denied";
    const permission = await Notification.requestPermission();
    return permission;
};

export const sendNotification = (title: string, options?: NotificationOptions) => {
    if (isNotificationSupported() && Notification.permission === "granted") {
        return new Notification(title, {
            icon: "/favicon.ico", // Path to your app's icon
            ...options,
        });
    }
    return null;
};
