use tauri_plugin_sql::{Migration, MigrationKind};

/// Must match `DATABASE_URL` in `src/db/client.ts`.
const DATABASE_URL: &str = "sqlite:fitness-challenge.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "lifecycle_rules",
            sql: include_str!("../migrations/0002_lifecycle_rules.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "speed_fit",
            sql: include_str!("../migrations/0003_speed_fit.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "category_library",
            sql: include_str!("../migrations/0004_category_library.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "late_entries",
            sql: include_str!("../migrations/0005_late_entries.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(DATABASE_URL, migrations())
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
