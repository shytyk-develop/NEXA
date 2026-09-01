const DEVICE_ID_KEY = 'nexa.deviceId';

export function getDeviceId() {
    try {
        const existing = localStorage.getItem(DEVICE_ID_KEY);
        if (existing && isUuid(existing)) return existing;
        const created = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, created);
        return created;
    } catch {
        return crypto.randomUUID();
    }
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function detectDeviceInfo({ includeBrowser = false } = {}) {
    const ua = navigator.userAgent || '';
    const platformHint = navigator.userAgentData?.platform || navigator.platform || '';
    let name = 'This browser';
    let platform = 'web';
    let osVersion = platformHint || 'Unknown OS';

    if (/iPhone|iPad|iPod/i.test(ua)) {
        const isPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        name = isPad ? 'iPad' : 'iPhone';
        platform = isPad ? 'ipados' : 'ios';
        const ver = ua.match(/OS (\d+[._]\d+(?:[._]\d+)?)/);
        osVersion = ver
            ? `${isPad ? 'iPadOS' : 'iOS'} ${ver[1].replace(/_/g, '.')}`
            : (isPad ? 'iPadOS' : 'iOS');
    } else if (/Macintosh|Mac OS X/i.test(ua) || /Mac/i.test(platformHint)) {
        name = 'Mac';
        platform = 'macos';
        const ver = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
        osVersion = ver ? `macOS ${ver[1].replace(/_/g, '.')}` : 'macOS';
    } else if (/Windows/i.test(ua) || /Win/i.test(platformHint)) {
        name = 'Windows PC';
        platform = 'windows';
        osVersion = windowsVersionFromUa(ua);
    } else if (/Android/i.test(ua)) {
        name = 'Android device';
        platform = 'android';
        const ver = ua.match(/Android (\d+(?:\.\d+)?)/);
        osVersion = ver ? `Android ${ver[1]}` : 'Android';
    } else if (/Linux/i.test(ua) || /Linux/i.test(platformHint)) {
        name = 'Linux PC';
        platform = 'linux';
        osVersion = 'Linux';
    }

    if (includeBrowser) {
        const browser = browserLabel(ua);
        if (browser) name = `${name} · ${browser}`;
    }

    return {
        deviceId: getDeviceId(),
        name,
        platform,
        osVersion,
        os: osVersion,
    };
}

function browserLabel(ua) {
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari';
    return '';
}

function windowsVersionFromUa(ua) {
    if (/Windows NT 10/i.test(ua)) return 'Windows 10/11';
    if (/Windows NT 6\.3/i.test(ua)) return 'Windows 8.1';
    if (/Windows NT 6\.1/i.test(ua)) return 'Windows 7';
    return 'Windows';
}

export async function enrichDeviceInfo(info) {
    const data = navigator.userAgentData;
    if (!data?.getHighEntropyValues) return info;
    try {
        const ua = await data.getHighEntropyValues(['platform', 'platformVersion', 'model']);
        const next = { ...info };
        const plat = (ua.platform || '').toLowerCase();
        const version = ua.platformVersion || '';
        if (plat.includes('mac')) {
            next.name = 'Mac';
            next.platform = 'macos';
            next.osVersion = version ? `macOS ${version}` : next.osVersion;
        } else if (plat.includes('win')) {
            next.name = 'Windows PC';
            next.platform = 'windows';
            next.osVersion = windowsLabelFromPlatformVersion(version) || next.osVersion;
        } else if (plat.includes('android')) {
            next.name = ua.model || 'Android device';
            next.platform = 'android';
            next.osVersion = version ? `Android ${version}` : next.osVersion;
        } else if (plat.includes('linux')) {
            next.name = 'Linux PC';
            next.platform = 'linux';
            next.osVersion = version ? `Linux ${version}` : 'Linux';
        }
        next.os = next.osVersion;
        return next;
    } catch {
        return info;
    }
}

function windowsLabelFromPlatformVersion(version) {
    if (!version) return '';
    const major = parseInt(String(version).split('.')[0], 10);
    if (Number.isNaN(major)) return `Windows ${version}`;
    if (major >= 13) return `Windows 11 (${version})`;
    if (major >= 10) return `Windows 10 (${version})`;
    return `Windows ${version}`;
}

export function devicePayload(info) {
    return {
        device_id: info.deviceId || getDeviceId(),
        device_name: info.name,
        platform: info.platform,
        os_version: info.osVersion || info.os || '',
    };
}
