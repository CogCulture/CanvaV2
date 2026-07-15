use std::sync::Arc;
use tokio::net::TcpListener;
use rapidraw_lib::{app_state::AppState, api_router::create_router};
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use tokio::sync::Mutex as TokioMutex;

#[tokio::main]
async fn main() {
    // initialize tracing
    tracing_subscriber::fmt::init();

    let state = Arc::new(AppState {
        window_setup_complete: AtomicBool::new(false),
        gpu_crash_flag_path: Mutex::new(None),
        original_image: Mutex::new(None),
        cached_preview: Mutex::new(None),
        gpu_context: Mutex::new(None),
        gpu_image_cache: Mutex::new(None),
        gpu_processor: Mutex::new(None),
        ai_state: Mutex::new(None),
        ai_init_lock: TokioMutex::new(()),
        export_task_handle: Mutex::new(None),
        hdr_result: Arc::new(Mutex::new(None)),
        panorama_result: Arc::new(Mutex::new(None)),
        denoise_result: Arc::new(Mutex::new(None)),
        indexing_task_handle: Mutex::new(None),
        lut_cache: Mutex::new(HashMap::new()),
        initial_file_path: Mutex::new(None),
        thumbnail_cancellation_token: Arc::new(AtomicBool::new(false)),
        thumbnail_progress: Mutex::new(rapidraw_lib::app_state::ThumbnailProgressTracker { total: 0, completed: 0 }),
        preview_worker_tx: Mutex::new(None),
        analytics_worker_tx: Mutex::new(None),
        mask_cache: Mutex::new(HashMap::new()),
        patch_cache: Mutex::new(HashMap::new()),
        geometry_cache: Mutex::new(HashMap::new()),
        thumbnail_geometry_cache: Mutex::new(HashMap::new()),
        lens_db: Mutex::new(None),
        load_image_generation: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        full_warped_cache: Mutex::new(None),
        full_transformed_cache: Mutex::new(None),
        decoded_image_cache: Mutex::new(rapidraw_lib::cache_utils::DecodedImageCache::new(5)),
        thumbnail_manager: rapidraw_lib::app_state::ThumbnailManager::new(),
    });
    rapidraw_lib::start_preview_worker(rapidraw_lib::DummyAppHandle { state: Some(state.clone()) });
    rapidraw_lib::start_analytics_worker(rapidraw_lib::DummyAppHandle { state: Some(state.clone()) });
    rapidraw_lib::file_management::start_thumbnail_workers(rapidraw_lib::DummyAppHandle { state: Some(state.clone()) });

    let app = create_router(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("Starting RapidRAW web server on http://{}", addr);
    let listener = TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
