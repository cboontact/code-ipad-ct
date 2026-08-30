UPDATE system_settings
SET value = 'iPad A16 WiFi+Cellular 128GB',
    updated_at = datetime('now')
WHERE key = 'device_model'
  AND value = 'iPad A16';
