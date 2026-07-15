use axum::{routing::{post, get}, Router, extract::{State, Json, Query}, response::IntoResponse};
use serde_json::Value;
use serde::Deserialize;
use crate::app_state::AppState;
use std::sync::Arc;
use crate::export_processing::ExportSettings;
use crate::GeometryParams;
use crate::mask_generation::AiPatchDefinition;
use crate::CommunityPreset;
use crate::file_management::PresetItem;
use crate::app_settings::AppSettings;
use crate::file_management::ImportSettings;
use crate::culling::CullingSettings;
use crate::negative_conversion::NegativeConversionParams;

// Type alias for handler errors — a plain String is returned as a 500 response body
type AppError = String;


#[derive(Deserialize)]
pub struct InvokePayload {
    pub command: String,
    pub args: Option<Value>,
}

pub async fn handle_invoke(State(state): State<Arc<AppState>>, Json(payload): Json<InvokePayload>) -> Result<axum::response::Response, AppError> {
    let mut should_load = false;
    let mut load_path = String::new();

    {
        let is_image_command = payload.command == "apply_adjustments" || payload.command == "generate_uncropped_preview" || payload.command == "preview_geometry_transform";
        if is_image_command {
            if let Some(args_val) = &payload.args {
                if let Some(path_val) = args_val.get("path") {
                    if let Ok(path) = serde_json::from_value::<String>(path_val.clone()) {
                        let original_img_guard = state.original_image.lock().unwrap();
                        if let Some(img) = original_img_guard.as_ref() {
                            if img.path != path {
                                should_load = true;
                                load_path = path;
                            }
                        } else {
                            should_load = true;
                            load_path = path;
                        }
                    }
                }
            }
        }
    }

    if should_load {
        let _ = crate::image_loader::load_image(
            load_path, 
            axum::extract::State(state.clone()), 
            crate::DummyAppHandle { state: Some(state.clone()) }
        ).await;
    }

    match payload.command.as_str() {
        "load_image" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for load_image")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::image_loader::load_image(path, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "apply_adjustments" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments")?;
            let is_interactive: bool = serde_json::from_value(args_val.get("is_interactive").or_else(|| args_val.get("isInteractive")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments")?;
            let target_resolution: Option<u32> = serde_json::from_value(args_val.get("target_resolution").or_else(|| args_val.get("targetResolution")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments")?;
            let roi: Option<(f32, f32, f32, f32)> = serde_json::from_value(args_val.get("roi").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments")?;
            let compute_waveform: bool = serde_json::from_value(args_val.get("compute_waveform").or_else(|| args_val.get("computeWaveform")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments")?;
            let active_waveform_channel: Option<String> = serde_json::from_value(args_val.get("active_waveform_channel").or_else(|| args_val.get("activeWaveformChannel")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::apply_adjustments(js_adjustments, is_interactive, target_resolution, roi, compute_waveform, active_waveform_channel, axum::extract::State(state.clone())).await;
            let res = res?;
            Ok(axum::response::IntoResponse::into_response(res))
        },
        "export_images" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let output_folder_or_file: String = serde_json::from_value(args_val.get("output_folder_or_file").or_else(|| args_val.get("outputFolderOrFile")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let is_explicit_file_path: bool = serde_json::from_value(args_val.get("is_explicit_file_path").or_else(|| args_val.get("isExplicitFilePath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let base_origin_folders: Vec<String> = serde_json::from_value(args_val.get("base_origin_folders").or_else(|| args_val.get("baseOriginFolders")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let export_settings: ExportSettings = serde_json::from_value(args_val.get("export_settings").or_else(|| args_val.get("exportSettings")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let output_format: String = serde_json::from_value(args_val.get("output_format").or_else(|| args_val.get("outputFormat")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let current_edit_path: Option<String> = serde_json::from_value(args_val.get("current_edit_path").or_else(|| args_val.get("currentEditPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for export_images")?;
            let current_edit_adjustments: Option<Value> = serde_json::from_value(args_val.get("current_edit_adjustments").or_else(|| args_val.get("currentEditAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::export_processing::export_images(paths, output_folder_or_file, is_explicit_file_path, base_origin_folders, export_settings, output_format, current_edit_path, current_edit_adjustments, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "cancel_export" => {
            let res = crate::export_processing::cancel_export(axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "estimate_export_sizes" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for estimate_export_sizes")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for estimate_export_sizes")?;
            let export_settings: ExportSettings = serde_json::from_value(args_val.get("export_settings").or_else(|| args_val.get("exportSettings")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for estimate_export_sizes")?;
            let output_format: String = serde_json::from_value(args_val.get("output_format").or_else(|| args_val.get("outputFormat")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for estimate_export_sizes")?;
            let current_edit_path: Option<String> = serde_json::from_value(args_val.get("current_edit_path").or_else(|| args_val.get("currentEditPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for estimate_export_sizes")?;
            let current_edit_adjustments: Option<Value> = serde_json::from_value(args_val.get("current_edit_adjustments").or_else(|| args_val.get("currentEditAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::export_processing::estimate_export_sizes(paths, export_settings, output_format, current_edit_path, current_edit_adjustments, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_preview_for_path" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_preview_for_path")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_preview_for_path")?;
            let js_adjustments: Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::generate_preview_for_path(path, js_adjustments, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            Ok(axum::response::IntoResponse::into_response(res))
        },
        "get_thumbnail_for_path" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_thumbnail_for_path")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::get_thumbnail_for_path(&path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "update_thumbnail_queue" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for update_thumbnail_queue")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::update_thumbnail_queue(paths, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "is_image_cached" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for is_image_cached")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::image_loader::is_image_cached(path, axum::extract::State(state.clone()));
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "resolve_android_content_uri_name" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for resolve_android_content_uri_name")?;
            let uri_str: String = serde_json::from_value(args_val.get("uri_str").or_else(|| args_val.get("uriStr")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::android_integration::resolve_android_content_uri_name(&uri_str);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_or_create_internal_library_root" => {
            let res = crate::file_management::get_or_create_internal_library_root(crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_original_transformed_preview" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_original_transformed_preview")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_original_transformed_preview")?;
            let target_resolution: Option<u32> = serde_json::from_value(args_val.get("target_resolution").or_else(|| args_val.get("targetResolution")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::generate_original_transformed_preview(js_adjustments, target_resolution, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_preset_preview" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_preset_preview")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::generate_preset_preview(js_adjustments, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            Ok(axum::response::IntoResponse::into_response(res))
        },
        "generate_uncropped_preview" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_uncropped_preview")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::generate_uncropped_preview(js_adjustments, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "preview_geometry_transform" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for preview_geometry_transform")?;
            let params: GeometryParams = serde_json::from_value(args_val.get("params").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for preview_geometry_transform")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for preview_geometry_transform")?;
            let show_lines: bool = serde_json::from_value(args_val.get("show_lines").or_else(|| args_val.get("showLines")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::preview_geometry_transform(params, js_adjustments, show_lines, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_mask_overlay" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_mask_overlay")?;
            let mask_def: serde_json::Value = serde_json::from_value(args_val.get("mask_def").or_else(|| args_val.get("maskDef")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_mask_overlay")?;
            let width: u32 = serde_json::from_value(args_val.get("width").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_mask_overlay")?;
            let height: u32 = serde_json::from_value(args_val.get("height").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_mask_overlay")?;
            let scale: f32 = serde_json::from_value(args_val.get("scale").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_mask_overlay")?;
            let crop_offset: (f32, f32) = serde_json::from_value(args_val.get("crop_offset").or_else(|| args_val.get("cropOffset")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_mask_overlay")?;
            let js_adjustments: Option<serde_json::Value> = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::mask_generation::generate_mask_overlay(mask_def, width, height, scale, crop_offset, js_adjustments, axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_ai_subject_mask" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let start_point: (f64, f64) = serde_json::from_value(args_val.get("start_point").or_else(|| args_val.get("startPoint")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let end_point: (f64, f64) = serde_json::from_value(args_val.get("end_point").or_else(|| args_val.get("endPoint")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let rotation: f32 = serde_json::from_value(args_val.get("rotation").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let flip_horizontal: bool = serde_json::from_value(args_val.get("flip_horizontal").or_else(|| args_val.get("flipHorizontal")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let flip_vertical: bool = serde_json::from_value(args_val.get("flip_vertical").or_else(|| args_val.get("flipVertical")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_subject_mask")?;
            let orientation_steps: u8 = serde_json::from_value(args_val.get("orientation_steps").or_else(|| args_val.get("orientationSteps")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::ai_commands::generate_ai_subject_mask(js_adjustments, path, start_point, end_point, rotation, flip_horizontal, flip_vertical, orientation_steps, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "precompute_ai_subject_mask" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for precompute_ai_subject_mask")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for precompute_ai_subject_mask")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::ai_commands::precompute_ai_subject_mask(js_adjustments, path, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_ai_foreground_mask" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_foreground_mask")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_foreground_mask")?;
            let rotation: f32 = serde_json::from_value(args_val.get("rotation").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_foreground_mask")?;
            let flip_horizontal: bool = serde_json::from_value(args_val.get("flip_horizontal").or_else(|| args_val.get("flipHorizontal")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_foreground_mask")?;
            let flip_vertical: bool = serde_json::from_value(args_val.get("flip_vertical").or_else(|| args_val.get("flipVertical")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_foreground_mask")?;
            let orientation_steps: u8 = serde_json::from_value(args_val.get("orientation_steps").or_else(|| args_val.get("orientationSteps")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::ai_commands::generate_ai_foreground_mask(js_adjustments, rotation, flip_horizontal, flip_vertical, orientation_steps, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_ai_sky_mask" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_sky_mask")?;
            let js_adjustments: serde_json::Value = serde_json::from_value(args_val.get("js_adjustments").or_else(|| args_val.get("jsAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_sky_mask")?;
            let rotation: f32 = serde_json::from_value(args_val.get("rotation").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_sky_mask")?;
            let flip_horizontal: bool = serde_json::from_value(args_val.get("flip_horizontal").or_else(|| args_val.get("flipHorizontal")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_sky_mask")?;
            let flip_vertical: bool = serde_json::from_value(args_val.get("flip_vertical").or_else(|| args_val.get("flipVertical")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_ai_sky_mask")?;
            let orientation_steps: u8 = serde_json::from_value(args_val.get("orientation_steps").or_else(|| args_val.get("orientationSteps")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::ai_commands::generate_ai_sky_mask(js_adjustments, rotation, flip_horizontal, flip_vertical, orientation_steps, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "check_ai_connector_status" => {
            let res = crate::ai_commands::check_ai_connector_status(crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "test_ai_connector_connection" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for test_ai_connector_connection")?;
            let address: String = serde_json::from_value(args_val.get("address").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::ai_commands::test_ai_connector_connection(address).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "invoke_generative_replace_with_mask_def" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for invoke_generative_replace_with_mask_def")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for invoke_generative_replace_with_mask_def")?;
            let patch_definition: AiPatchDefinition = serde_json::from_value(args_val.get("patch_definition").or_else(|| args_val.get("patchDefinition")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for invoke_generative_replace_with_mask_def")?;
            let current_adjustments: Value = serde_json::from_value(args_val.get("current_adjustments").or_else(|| args_val.get("currentAdjustments")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for invoke_generative_replace_with_mask_def")?;
            let use_fast_inpaint: bool = serde_json::from_value(args_val.get("use_fast_inpaint").or_else(|| args_val.get("useFastInpaint")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for invoke_generative_replace_with_mask_def")?;
            let token: Option<String> = serde_json::from_value(args_val.get("token").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::ai_commands::invoke_generative_replace_with_mask_def(path, patch_definition, current_adjustments, use_fast_inpaint, token, crate::DummyAppHandle { state: Some(state.clone()) }, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_supported_file_types" => {
            let res = crate::file_management::get_supported_file_types();
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_log_file_path" => {
            let res = crate::get_log_file_path(crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "frontend_log" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for frontend_log")?;
            let level: String = serde_json::from_value(args_val.get("level").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for frontend_log")?;
            let message: String = serde_json::from_value(args_val.get("message").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::frontend_log(level, message);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_collage" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_collage")?;
            let base64_data: String = serde_json::from_value(args_val.get("base64_data").or_else(|| args_val.get("base64Data")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for save_collage")?;
            let first_path_str: String = serde_json::from_value(args_val.get("first_path_str").or_else(|| args_val.get("firstPathStr")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::save_collage(base64_data, first_path_str).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "stitch_panorama" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for stitch_panorama")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::panorama_stitching::stitch_panorama(paths, crate::DummyAppHandle { state: Some(state.clone()) }, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_panorama" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_panorama")?;
            let first_path_str: String = serde_json::from_value(args_val.get("first_path_str").or_else(|| args_val.get("firstPathStr")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::panorama_stitching::save_panorama(first_path_str, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "merge_hdr" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for merge_hdr")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::merge_hdr(paths, crate::DummyAppHandle { state: Some(state.clone()) }, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_hdr" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_hdr")?;
            let first_path_str: String = serde_json::from_value(args_val.get("first_path_str").or_else(|| args_val.get("firstPathStr")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::save_hdr(first_path_str, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "apply_denoising" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_denoising")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_denoising")?;
            let intensity: f32 = serde_json::from_value(args_val.get("intensity").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_denoising")?;
            let method: String = serde_json::from_value(args_val.get("method").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::denoising::apply_denoising(path, intensity, method, crate::DummyAppHandle { state: Some(state.clone()) }, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_denoised_image" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_denoised_image")?;
            let original_path_str: String = serde_json::from_value(args_val.get("original_path_str").or_else(|| args_val.get("originalPathStr")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::denoising::save_denoised_image(original_path_str, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "load_and_parse_lut" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for load_and_parse_lut")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::load_and_parse_lut(path, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "fetch_community_presets" => {
            let res = crate::fetch_community_presets().await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "generate_all_community_previews" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_all_community_previews")?;
            let image_paths: Vec<String> = serde_json::from_value(args_val.get("image_paths").or_else(|| args_val.get("imagePaths")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for generate_all_community_previews")?;
            let presets: Vec<CommunityPreset> = serde_json::from_value(args_val.get("presets").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::generate_all_community_previews(image_paths, presets, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_temp_file" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_temp_file")?;
            let bytes: Vec<u8> = serde_json::from_value(args_val.get("bytes").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::save_temp_file(bytes).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_svg_to_directory" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_svg_to_directory")?;
            let directory: String = serde_json::from_value(args_val.get("directory").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let filename: String = serde_json::from_value(args_val.get("filename").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let svg_text: String = serde_json::from_value(args_val.get("svg_text").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::save_svg_to_directory(directory, filename, svg_text).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "fetch_svg_content" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for fetch_svg_content")?;
            let url: String = serde_json::from_value(args_val.get("url").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::fetch_svg_content(url).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_image_dimensions" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_image_dimensions")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::get_image_dimensions(path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "frontend_ready" => {
            let res = crate::frontend_ready(crate::DummyAppHandle { state: Some(state.clone()) }, crate::DummyWindow{}, axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "cancel_thumbnail_generation" => {
            let res = crate::cancel_thumbnail_generation(axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "calculate_auto_adjustments" => {
            let res = crate::image_processing::calculate_auto_adjustments(axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "read_exif_for_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for read_exif_for_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::read_exif_for_paths(paths).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "list_images_in_dir" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for list_images_in_dir")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::list_images_in_dir(path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "list_images_recursive" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for list_images_recursive")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::list_images_recursive(path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_folder_tree" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_folder_tree")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_folder_tree")?;
            let expanded_folders: Vec<String> = serde_json::from_value(args_val.get("expanded_folders").or_else(|| args_val.get("expandedFolders")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_folder_tree")?;
            let show_image_counts: bool = serde_json::from_value(args_val.get("show_image_counts").or_else(|| args_val.get("showImageCounts")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::get_folder_tree(path, expanded_folders, show_image_counts).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_folder_children" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_folder_children")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_folder_children")?;
            let show_image_counts: bool = serde_json::from_value(args_val.get("show_image_counts").or_else(|| args_val.get("showImageCounts")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::get_folder_children(path, show_image_counts).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_pinned_folder_trees" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_pinned_folder_trees")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_pinned_folder_trees")?;
            let expanded_folders: Vec<String> = serde_json::from_value(args_val.get("expanded_folders").or_else(|| args_val.get("expandedFolders")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_pinned_folder_trees")?;
            let show_image_counts: bool = serde_json::from_value(args_val.get("show_image_counts").or_else(|| args_val.get("showImageCounts")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::get_pinned_folder_trees(paths, expanded_folders, show_image_counts).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "create_folder" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for create_folder")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::create_folder(path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "delete_folder" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for delete_folder")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::delete_folder(path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "copy_files" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for copy_files")?;
            let source_paths: Vec<String> = serde_json::from_value(args_val.get("source_paths").or_else(|| args_val.get("sourcePaths")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for copy_files")?;
            let destination_folder: String = serde_json::from_value(args_val.get("destination_folder").or_else(|| args_val.get("destinationFolder")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::copy_files(source_paths, destination_folder);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "move_files" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for move_files")?;
            let source_paths: Vec<String> = serde_json::from_value(args_val.get("source_paths").or_else(|| args_val.get("sourcePaths")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for move_files")?;
            let destination_folder: String = serde_json::from_value(args_val.get("destination_folder").or_else(|| args_val.get("destinationFolder")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::move_files(source_paths, destination_folder, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "rename_folder" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for rename_folder")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for rename_folder")?;
            let new_name: String = serde_json::from_value(args_val.get("new_name").or_else(|| args_val.get("newName")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::rename_folder(path, new_name, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "rename_files" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for rename_files")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for rename_files")?;
            let name_template: String = serde_json::from_value(args_val.get("name_template").or_else(|| args_val.get("nameTemplate")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::rename_files(paths, name_template, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "duplicate_file" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for duplicate_file")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for duplicate_file")?;
            let target_album_id: Option<String> = serde_json::from_value(args_val.get("target_album_id").or_else(|| args_val.get("targetAlbumId")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::duplicate_file(path, target_album_id, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "show_in_finder" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for show_in_finder")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::show_in_finder(path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "delete_files_from_disk" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for delete_files_from_disk")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::delete_files_from_disk(paths, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "delete_files_with_associated" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for delete_files_with_associated")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::delete_files_with_associated(paths, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_metadata_and_update_thumbnail" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_metadata_and_update_thumbnail")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for save_metadata_and_update_thumbnail")?;
            let adjustments: Value = serde_json::from_value(args_val.get("adjustments").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::save_metadata_and_update_thumbnail(path, adjustments, crate::DummyAppHandle { state: Some(state.clone()) }, axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "apply_adjustments_to_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments_to_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_adjustments_to_paths")?;
            let adjustments: Value = serde_json::from_value(args_val.get("adjustments").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::apply_adjustments_to_paths(paths, adjustments, crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "load_metadata" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for load_metadata")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::load_metadata(path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "load_presets" => {
            let res = crate::file_management::load_presets(crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_presets" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_presets")?;
            let presets: Vec<PresetItem> = serde_json::from_value(args_val.get("presets").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::save_presets(presets, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "load_settings" => {
            let res = crate::app_settings::load_settings(crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_settings" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_settings")?;
            let settings: AppSettings = serde_json::from_value(args_val.get("settings").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::app_settings::save_settings(settings, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "reset_adjustments_for_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for reset_adjustments_for_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::reset_adjustments_for_paths(paths, crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "apply_auto_adjustments_to_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for apply_auto_adjustments_to_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::apply_auto_adjustments_to_paths(paths, crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "handle_import_presets_from_file" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for handle_import_presets_from_file")?;
            let file_path: String = serde_json::from_value(args_val.get("file_path").or_else(|| args_val.get("filePath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::handle_import_presets_from_file(file_path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "handle_import_legacy_presets_from_file" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for handle_import_legacy_presets_from_file")?;
            let file_path: String = serde_json::from_value(args_val.get("file_path").or_else(|| args_val.get("filePath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::handle_import_legacy_presets_from_file(file_path, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "handle_export_presets_to_file" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for handle_export_presets_to_file")?;
            let presets_to_export: Vec<PresetItem> = serde_json::from_value(args_val.get("presets_to_export").or_else(|| args_val.get("presetsToExport")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for handle_export_presets_to_file")?;
            let file_path: String = serde_json::from_value(args_val.get("file_path").or_else(|| args_val.get("filePath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::handle_export_presets_to_file(presets_to_export, file_path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "save_community_preset" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for save_community_preset")?;
            let name: String = serde_json::from_value(args_val.get("name").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for save_community_preset")?;
            let adjustments: Value = serde_json::from_value(args_val.get("adjustments").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for save_community_preset")?;
            let include_masks: Option<bool> = serde_json::from_value(args_val.get("include_masks").or_else(|| args_val.get("includeMasks")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for save_community_preset")?;
            let include_crop_transform: Option<bool> = serde_json::from_value(args_val.get("include_crop_transform").or_else(|| args_val.get("includeCropTransform")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for save_community_preset")?;
            let preset_type: Option<String> = serde_json::from_value(args_val.get("preset_type").or_else(|| args_val.get("presetType")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::save_community_preset(name, adjustments, crate::DummyAppHandle { state: Some(state.clone()) }, include_masks, include_crop_transform, preset_type);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "clear_all_sidecars" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for clear_all_sidecars")?;
            let root_path: String = serde_json::from_value(args_val.get("root_path").or_else(|| args_val.get("rootPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::clear_all_sidecars(root_path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "clear_thumbnail_cache" => {
            let res = crate::file_management::clear_thumbnail_cache(crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "set_color_label_for_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for set_color_label_for_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for set_color_label_for_paths")?;
            let color: Option<String> = serde_json::from_value(args_val.get("color").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::set_color_label_for_paths(paths, color, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "import_files" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for import_files")?;
            let source_paths: Vec<String> = serde_json::from_value(args_val.get("source_paths").or_else(|| args_val.get("sourcePaths")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for import_files")?;
            let destination_folder: String = serde_json::from_value(args_val.get("destination_folder").or_else(|| args_val.get("destinationFolder")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for import_files")?;
            let settings: ImportSettings = serde_json::from_value(args_val.get("settings").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::import_files(source_paths, destination_folder, settings, crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "create_virtual_copy" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for create_virtual_copy")?;
            let source_virtual_path: String = serde_json::from_value(args_val.get("source_virtual_path").or_else(|| args_val.get("sourceVirtualPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for create_virtual_copy")?;
            let target_album_id: Option<String> = serde_json::from_value(args_val.get("target_album_id").or_else(|| args_val.get("targetAlbumId")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::file_management::create_virtual_copy(source_virtual_path, target_album_id, crate::DummyAppHandle { state: Some(state.clone()) });
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "start_background_indexing" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for start_background_indexing")?;
            let folder_path: String = serde_json::from_value(args_val.get("folder_path").or_else(|| args_val.get("folderPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::tagging::start_background_indexing(folder_path, crate::DummyAppHandle { state: Some(state.clone()) }, axum::extract::State(state.clone())).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "clear_ai_tags" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for clear_ai_tags")?;
            let root_path: String = serde_json::from_value(args_val.get("root_path").or_else(|| args_val.get("rootPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::tagging::clear_ai_tags(root_path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "clear_all_tags" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for clear_all_tags")?;
            let root_path: String = serde_json::from_value(args_val.get("root_path").or_else(|| args_val.get("rootPath")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::tagging::clear_all_tags(root_path);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "add_tag_for_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for add_tag_for_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for add_tag_for_paths")?;
            let tag: String = serde_json::from_value(args_val.get("tag").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::tagging::add_tag_for_paths(paths, tag);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "remove_tag_for_paths" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for remove_tag_for_paths")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for remove_tag_for_paths")?;
            let tag: String = serde_json::from_value(args_val.get("tag").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::tagging::remove_tag_for_paths(paths, tag);
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "cull_images" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for cull_images")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for cull_images")?;
            let settings: CullingSettings = serde_json::from_value(args_val.get("settings").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::culling::cull_images(paths, settings, crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_lensfun_makers" => {
            let res = crate::lens_correction::get_lensfun_makers(axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_lensfun_lenses_for_maker" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_lensfun_lenses_for_maker")?;
            let maker: String = serde_json::from_value(args_val.get("maker").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::lens_correction::get_lensfun_lenses_for_maker(maker, axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "autodetect_lens" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for autodetect_lens")?;
            let maker: String = serde_json::from_value(args_val.get("maker").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for autodetect_lens")?;
            let model: String = serde_json::from_value(args_val.get("model").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::lens_correction::autodetect_lens(maker, model, axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "get_lens_distortion_params" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for get_lens_distortion_params")?;
            let maker: String = serde_json::from_value(args_val.get("maker").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_lens_distortion_params")?;
            let model: String = serde_json::from_value(args_val.get("model").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_lens_distortion_params")?;
            let focal_length: f32 = serde_json::from_value(args_val.get("focal_length").or_else(|| args_val.get("focalLength")).cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_lens_distortion_params")?;
            let aperture: Option<f32> = serde_json::from_value(args_val.get("aperture").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for get_lens_distortion_params")?;
            let distance: Option<f32> = serde_json::from_value(args_val.get("distance").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::lens_correction::get_lens_distortion_params(maker, model, focal_length, aperture, distance, axum::extract::State(state.clone()));
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "preview_negative_conversion" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for preview_negative_conversion")?;
            let path: String = serde_json::from_value(args_val.get("path").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for preview_negative_conversion")?;
            let params: NegativeConversionParams = serde_json::from_value(args_val.get("params").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::negative_conversion::preview_negative_conversion(path, params, axum::extract::State(state.clone()), crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        "convert_negatives" => {
            let args_val = payload.args.as_ref().ok_or("Missing args for convert_negatives")?;
            let paths: Vec<String> = serde_json::from_value(args_val.get("paths").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let args_val = payload.args.as_ref().ok_or("Missing args for convert_negatives")?;
            let params: NegativeConversionParams = serde_json::from_value(args_val.get("params").cloned().unwrap_or(Value::Null)).map_err(|e| e.to_string())?;
            let res = crate::negative_conversion::convert_negatives(paths, params, crate::DummyAppHandle { state: Some(state.clone()) }).await;
            let res = res?;
            let json_res = serde_json::to_value(res).unwrap_or(Value::Null);
            Ok(axum::response::IntoResponse::into_response(Json(json_res)))
        },
        _ => Err(format!("Command not found: {}", payload.command))
    }
}

async fn serve_static_file(Query(params): Query<std::collections::HashMap<String, String>>) -> Result<axum::response::Response, AppError> {
    let path = params.get("path").ok_or("Missing path parameter".to_string())?;
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    // Detect content type from extension
    let content_type = if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    };
    let response = axum::response::Response::builder()
        .header("Content-Type", content_type)
        .header("Access-Control-Allow-Origin", "*")
        .body(axum::body::Body::from(bytes))
        .map_err(|e| e.to_string())?;
    Ok(response)
}

async fn handle_upload(mut multipart: axum::extract::Multipart) -> Result<axum::response::Response, AppError> {
    let mut temp_path = String::new();
    while let Some(field) = multipart.next_field().await.map_err(|e| e.to_string())? {
        let field_name = field.name().unwrap_or("").to_string();
        
        if field_name == "url" {
            // Frontend sent a remote URL — download it server-side to bypass CORS
            let url = field.text().await.map_err(|e| e.to_string())?;
            if url.starts_with("http") {
                let response = reqwest::get(&url).await.map_err(|e| e.to_string())?;
                let bytes = response.bytes().await.map_err(|e| e.to_string())?;
                let uuid = uuid::Uuid::new_v4().to_string();
                let path = format!("/tmp/rapidraw_upload_{}.png", uuid);
                std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
                temp_path = path;
                break;
            }
            // url field was not http — fall through to next field
        } else {
            // Regular file upload
            let file_name = field.file_name().unwrap_or("unknown").to_string();
            let data = field.bytes().await.map_err(|e| e.to_string())?;
            let ext = std::path::Path::new(&file_name)
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("png");
            let uuid = uuid::Uuid::new_v4().to_string();
            let path = format!("/tmp/rapidraw_upload_{}.{}", uuid, ext);
            std::fs::write(&path, data).map_err(|e| e.to_string())?;
            temp_path = path;
            break;
        }
    }
    
    if temp_path.is_empty() {
        return Err("No file found in multipart upload".to_string());
    }
    
    let json_res = serde_json::json!({ "path": temp_path });
    Ok(axum::response::IntoResponse::into_response(Json(json_res)))
}

async fn handle_download(Query(params): Query<std::collections::HashMap<String, String>>) -> Result<axum::response::Response, AppError> {
    let path = params.get("path").ok_or("Missing path parameter")?;
    
    // Basic security check: ensure it's from /tmp/ to prevent arbitrary file reading
    if !path.starts_with("/tmp/") {
        return Err("Invalid path".to_string());
    }
    
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    
    let content_type = if path.ends_with(".dng") || path.ends_with(".raw") {
        "image/x-adobe-dng"
    } else if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else {
        "application/octet-stream"
    };
    
    let response = axum::response::Response::builder()
        .header("Content-Type", content_type)
        .header("Content-Disposition", format!("attachment; filename=\"{}\"", std::path::Path::new(path).file_name().unwrap_or_default().to_string_lossy()))
        .header("Access-Control-Allow-Origin", "*")
        .body(axum::body::Body::from(bytes))
        .map_err(|e| e.to_string())?;
    Ok(response)
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/api/invoke", post(handle_invoke))
        .route("/api/static", get(serve_static_file))
        .route("/api/upload", post(handle_upload))
        .route("/api/download", get(handle_download))
        .layer(axum::extract::DefaultBodyLimit::max(100 * 1024 * 1024)) // 100MB limit for base64 images
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(state)
}