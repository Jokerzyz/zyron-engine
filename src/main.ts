// Transitional DOM composition layer; extracted modules below are strict TypeScript.
// @ts-nocheck
import './styles.css';
import { BAYER_8X8, GridSampler } from './render/grid';
import { VideoFrameScheduler } from './media/video-frame-scheduler';
import { readPresets, writePresets } from './presets/storage';
import { loadFirebaseServices } from './services/firebase';
import { authErrorTranslationKey, hasVerifiedAccountAccess } from './auth/access';
import { packageZipFrames } from './export/zip-packager';
import { createSafeStorage } from './storage/safe-storage';

        // === 1. STATE & GLOBAL VARIABLES ===
        const appStorage = createSafeStorage(() => window.localStorage);
        const storedLang = appStorage.getItem('matrix_ui_lang');
        let currentLang = storedLang === 'en' || storedLang === 'zh' ? storedLang : ((navigator.language && navigator.language.startsWith('zh')) ? 'zh' : 'en');
        let isProUser = false;
        const storedFreeExports = Number.parseInt(appStorage.getItem('matrix_ui_free_exports_left') || '3', 10);
        let freeExportsLeft = Number.isFinite(storedFreeExports) ? Math.max(0, Math.min(3, storedFreeExports)) : 3;
        let currentUser = null;
        let currentAppId = 'zyronmatrix';
        let currentRenderMode = 'dot';
        let imageElement = null;
        let videoElement = null;
        let isVideo = false;
        let isExporting = false;
        let isRasterExporting = false;
        let isScrubbing = false;
        let wasPlaying = false;
        let isManuallyOverridingGrid = false;
        let keyframes = [];
        let isCssFullscreen = false;
        let userPresets = {};
        let currentMediaUrl = null;
        let mediaGeneration = 0;
        let unsubscribePresets = null;
        let unsubscribeAuth = null;
        let presetSubscriptionGeneration = 0;
        let authGeneration = 0;
        let authReady = false;
        let firebaseServices = null;
        let firebaseConnectionPromise = null;
        let exportAbortController = null;
        const exportControlStates = new Map();
        const gridSampler = new GridSampler();
        const videoFrameScheduler = new VideoFrameScheduler();

        const defaults = {
            gridSize: 20, dotScale: 0.85, sourceBrightness: 0, sourceContrast: 0,
            brightness: 20, contrast: 20, fps: 24, bgColor: "#000000", dotColor: "#ffffff",
            invertMapping: false, smoothStep: true, renderMode: 'dot',
            asciiLogic: 'mask', asciiChars: "THE OCEAN, WITH ITS VAST EXPANSE AND MYSTERIOUS ALLURE, HAS ALWAYS HELD A SPECIAL PLACE IN HUMAN HEARTS. ", asciiRatio: 0.6, asciiIntensity: 1, asciiRemoveSpaces: true,
            dotStyle: 'solid', customColorDark: "#000000", customColorMid: "#0066ff",
            customColorLight: "#ffffff", fixedDotSize: false, dotCutoff: 0.05,
            ditherThreshold: 0.50, ditherMethod: 'stucki', stuckiFactor: 100, ditherSquarePixels: true,
            glassImgScale: 1.0, glassImgOffsetX: 0, glassImgOffsetY: 0,
            glassExtract: 'auto', glassMaskW: 100, glassMaskH: 100, glassMaskX: 0, glassMaskY: 0,
            glassLight: 1.2, glassColorMode: 'spatial', glassSpatial1: '#b500ff', glassSpatial2: '#00e5ff',
            glassAngle: 135, glassOffset: 0, glassLut1: '#000000', glassLut2: '#0a2db5', glassLut3: '#16a6d1', glassLut4: '#f06d18', glassLut5: '#ffffff',
            glassBlur: 45, glassSharp: 0, glassStripe: 24, glassDisp: 15, glassShading: 0.6, glassNoise: 15
        };

        const translations = {
            en: {
                app_title: "ZYRONMATRIX", app_subtitle: "ASCII ENGINE", app_desc: "Free image & video to ASCII, dot matrix, dither, and glass effects",
                tab_dot: "Dot Matrix", tab_ascii: "Ascii Art", tab_dither: "1-Bit Dither", tab_glass: "Frosted Glass", lbl_source: "Source & Preset", status_synced: "Synced", status_local: "Local Storage", status_sync_err: "Sync Failed", status_conn: "Connecting...",
                btn_load: "Load Media", no_file: "No file selected...", no_file_preview: "NO MEDIA UPLOADED", opt_custom_preset: "-- Custom (Unsaved) --", tip_save_preset: "Save Preset", tip_del_preset: "Delete Preset", tip_theme: "Toggle Dark/Light Theme",
                lbl_geometry: "Geometry", btn_reset: "⟲ Reset", lbl_grid: "Grid Density", lbl_keyed: "(KEYED)", btn_add_key: "📍 Add Keyframe", btn_clear_key: "Clear Anims",
                lbl_scale: "Unit Scale (Gap)", lbl_scale_ascii: "Line Spacing & Scale", lbl_lock_dot: "Lock Dot Size (LED Look)", lbl_cutoff: "Darkness Cutoff",
                lbl_dither_threshold: "Threshold (1-Bit Cutoff)", lbl_dither: "Dithering Method", opt_dither_none: "None (Threshold 1-Bit)", opt_dither_bayer: "Bayer 8x8 (Ordered)", opt_dither_stucki: "Stucki (Error Diffusion)", lbl_stucki_factor: "Stucki Factor", lbl_pixel_shape: "Square Pixels",
                lbl_style: "Style & Color", lbl_bg: "Global BG Color", lbl_mapping: "Color Mapping",
                opt_vol_blue: "Volumetric Blue (Dark/Mid/Bright/White)", opt_solid: "Solid Flat Fill (Uniform Color)", opt_origin: "Pixelated Original Colors (True Color)", opt_vol_mono: "Volumetric Mono (Sketch/Shadows)", opt_vol_custom: "Custom Tri-tone Volumetric",
                lbl_shadow: "Shadows (Dark)", lbl_midtone: "Midtones", lbl_high: "Highlights",
                lbl_logic: "Layout & Render Logic", opt_density: "Density Mapping (Match chars by brightness)", opt_mask: "Continuous Text Mask (Text overlay + Alpha)",
                lbl_dict: "Char Dictionary or Text (Dark ➔ Bright)", opt_std: "Standard Grayscale", opt_extreme: "Extreme Details", opt_hacker: "Hacker Binary", opt_rgb: "RGB Cyberpunk", opt_retro: "Retro Typo", opt_block: "Pixel Blocks", opt_prose: "English Prose Mask", opt_custom: "Custom...",
                lbl_no_space: "Force Seamless (Remove Spaces)", lbl_aspect: "Char Aspect Ratio (Squish Width)", lbl_intensity: "Char Intensity (Overdraw Anti-blur)", lbl_dot_color: "Unit Emissive Color",
                lbl_filters: "Filters", lbl_src_b: "Source: Exposure Bias", lbl_src_c: "Source: Contrast Boost", lbl_map_b: "Mapping: Global Brightness", lbl_map_c: "Mapping: Tone Separation", lbl_invert: "Invert Mapping (Negative)", lbl_smooth: "Temporal Smoothstep Denoise",
                lbl_output: "Output", opt_res_src: "Original Canvas (1:1)", lbl_fps: "Sequence Export FPS", tip_fps: "💡 Tip: Image sequences lack FPS metadata. Right-click footage in AE/PR ➔ Interpret Footage ➔ Assume FPS.",
                btn_reset_all: "Reset All", btn_export_seq: "Render Sequence",
                status_res: "Target Resolution", status_mode: "Engine Mode", status_video: "Video Sequence", status_image: "Static Image",
                modal_exp_title: "Rendering Frames...", modal_exp_status: "PREPARING", btn_abort: "ABORT", btn_cancel: "CANCEL", btn_confirm: "CONFIRM",
                msg_sys_notice: "Notice", msg_err: "Error", msg_key_added: "✅ Recorded", msg_err_keyframe: "You must upload a video first to add keyframes!",
                msg_err_upload: "Please upload image or video first!", msg_err_render: "Render failed, try lower resolution.", msg_err_export_req: "Upload a video to export sequence.", msg_err_export: "Export interrupted, please retry.",
                msg_save_preset: "Save Preset", msg_enter_name: "Enter preset name:", msg_err_cloud: "Cloud failed, saved locally.", msg_del_preset: "Delete Preset", msg_confirm_del: "Are you sure you want to delete preset: ",
                msg_compressing: "Packaging ZIP archive...", msg_engine: "Rendering Engine: ", btn_guide: "GUIDE", tip_guide: "Read tutorials and learn about ASCII art",
                lbl_img_scale: "Image Scale", lbl_img_off_x: "Horizontal Offset", lbl_img_off_y: "Vertical Offset",
                lbl_extract: "Edge Extraction", opt_ext_auto: "Auto (Recommended)", opt_ext_alpha: "By Alpha (No BG)", opt_ext_luma: "By Luma (Black BG)",
                lbl_mask: "Lens Mask (Reveal)", lbl_mask_w: "Mask Width", lbl_mask_h: "Mask Height", lbl_mask_x: "Mask X Offset", lbl_mask_y: "Mask Y Offset",
                lbl_blur: "Glow Blur", lbl_sharp: "Subject Sharpness", lbl_stripe: "Stripe Width", lbl_disp: "Refraction Disp.", lbl_shading: "Glass Shading", lbl_noise: "Film Noise",
                lbl_light_int: "Light Intensity", opt_lut: "Global LUT Mapping", opt_spatial: "Spatial Gradient", lbl_col1: "Primary A", lbl_col2: "Secondary B", lbl_angle: "Gradient Angle", lbl_offset: "Gradient Offset", lbl_lut_cols: "LUT Colors (Dark to Bright)",
                lut_p1: "Classic Blue/Orange", lut_p2: "Cyberpunk", lut_p3: "Toxic", lut_p4: "Sunset", lut_p5: "Aurora",
                lbl_login_svg: "LOGIN TO UNLOCK", lbl_unlocked_svg: "EXPORT SVG FILE", btn_svg: "SVG", login_title: "Unlock Your Account", login_desc: "Use a verified free account to unlock unlimited image exports and Vector SVG downloads.", btn_google_login: "Continue with Google", btn_email_login: "SIGN IN", btn_email_register: "CREATE FREE ACCOUNT", ph_email: "Email Address", ph_password: "Password", lbl_or: "OR", btn_login_header: "LOGIN", btn_logout: "LOGOUT", btn_verify_email: "VERIFY EMAIL", tip_login: "Sign in or manage your account", msg_logged_out: "You have successfully logged out.",
                msg_auth_fields: "Enter both your email address and password.", msg_auth_signing_in: "Signing in…", msg_auth_registering: "Creating your account…", msg_auth_google_wait: "Opening Google sign-in…", msg_auth_verify_sent: "We sent a verification link to your email. Verify your address, then sign in.", msg_auth_verify_required: "Verify your email address before unlocking account features. A new verification link has been sent.",
                msg_auth_invalid_email: "Enter a valid email address.", msg_auth_invalid_credentials: "The email or password is incorrect.", msg_auth_email_used: "This email already has an account. Sign in instead.", msg_auth_weak_password: "Use a stronger password with at least 6 characters.", msg_auth_too_many: "Too many attempts. Wait a moment and try again.", msg_auth_network: "The authentication service is unreachable. Check your connection and retry.", msg_auth_disabled: "This sign-in method is not enabled.", msg_auth_popup_blocked: "The browser blocked the Google sign-in popup. Allow popups and retry.", msg_auth_popup_closed: "Google sign-in was cancelled.", msg_auth_unauthorized_domain: "This website domain is not authorized for Google sign-in.", msg_auth_provider_mismatch: "This email uses a different sign-in method.", msg_auth_user_disabled: "This account has been disabled.", msg_auth_unknown: "Authentication failed. Please retry.",
                msg_auth_changed: "The signed-in account changed. Please repeat the preset action.", msg_preset_name_invalid: "Preset names must be 1–80 characters and cannot contain a slash.", msg_delete_cloud: "The local preset was removed, but cloud deletion failed.",
                msg_drop_here: "DROP FILE HERE", msg_err_format: "Only image or video files are supported."
            },
            zh: {
                app_title: "ZYRONMATRIX", app_subtitle: "ASCII ENGINE", app_desc: "免费将图片和视频转换为 ASCII、点阵、抖动与玻璃效果",
                tab_dot: "圆点矩阵 (Dot)", tab_ascii: "ASCII 字符", tab_dither: "像素抖动 (Dither)", tab_glass: "长虹毛玻璃", lbl_source: "Source & Preset", status_synced: "已同步", status_local: "本地存储", status_sync_err: "同步失败", status_conn: "连接中...",
                btn_load: "载入媒体", no_file: "未选择文件...", no_file_preview: "等待载入媒体", opt_custom_preset: "-- 自定义参数 (未保存) --", tip_save_preset: "保存预设", tip_del_preset: "删除预设", tip_theme: "切换深浅色主题",
                lbl_geometry: "Geometry", btn_reset: "⟲ 恢复", lbl_grid: "阵列排版密度", lbl_keyed: "(KEYED)", btn_add_key: "📍 打关键帧", btn_clear_key: "清空动画",
                lbl_scale: "单元缩放 (间隙)", lbl_scale_ascii: "字符纵向行间距缩放", lbl_lock_dot: "锁定等大圆点 (LED化)", lbl_cutoff: "背景暗部剔除阈值",
                lbl_dither_threshold: "二值化切割阈值 (Threshold)", lbl_dither: "抖动算法 (Method)", opt_dither_none: "无 (二值化阈值切割)", opt_dither_bayer: "Bayer 8x8 (规则矩阵抖动)", opt_dither_stucki: "Stucki (误差扩散抖动)", lbl_stucki_factor: "扩散强度 (Stucki Factor)", lbl_pixel_shape: "方形像素块 (Square)",
                lbl_style: "Style & Color", lbl_bg: "全局底板颜色", lbl_mapping: "色彩渲染模式 (Mapping)",
                opt_vol_blue: "立体蓝调 (黑/深蓝/浅蓝/白)", opt_solid: "单色扁平填充 (统一发光色)", opt_origin: "像素化采样原片色彩 (真彩矩阵)", opt_vol_mono: "立体灰阶 (复古素描风格)", opt_vol_custom: "自定义三阶发光立体色",
                lbl_shadow: "阴影深色", lbl_midtone: "中间漫反射", lbl_high: "高光亮色",
                lbl_logic: "排版与渲染逻辑", opt_density: "亮度密度映射 (依明暗匹配不同字符)", opt_mask: "连续文本遮罩 (原文覆盖+透明度遮罩)",
                lbl_dict: "字符字典或长文本 (暗 ➔ 亮)", opt_std: "标准灰度", opt_extreme: "极限细节", opt_hacker: "黑客代码", opt_rgb: "彩色赛博代码 (RGB Code)", opt_retro: "复古排字", opt_block: "像素块", opt_prose: "英文散文遮罩", opt_custom: "自定义...",
                lbl_no_space: "强制无缝排版 (剔除空格)", lbl_aspect: "字符横向紧凑度 (挤压列间距)", lbl_intensity: "字符亮度强化 (Overdraw)", lbl_dot_color: "单元发光颜色",
                lbl_filters: "Filters", lbl_src_b: "输入源：曝光补偿", lbl_src_c: "输入源：对比强化", lbl_map_b: "映射层：全局光感", lbl_map_c: "映射层：色阶分离度", lbl_invert: "反转明暗映射 (Invert)", lbl_smooth: "时域平滑滤波去噪",
                lbl_output: "Output", opt_res_src: "原始画布尺寸 (1:1)", lbl_fps: "序列导出帧率 (FPS)", tip_fps: "💡 提示：图片序列无帧率元数据，导入 AE/PR 时请右键素材「解释素材 ➔ 假定帧率」为该数值。",
                btn_reset_all: "清空重置", btn_export_seq: "渲染导出无损序列",
                status_res: "解析度", status_mode: "识别模式", status_video: "视频序列", status_image: "静态图像",
                modal_exp_title: "正在渲染光栅序列", modal_exp_status: "引擎准备中", btn_abort: "中断渲染", btn_cancel: "取消", btn_confirm: "确认执行",
                msg_sys_notice: "提示", msg_err: "出错", msg_key_added: "✅ 记录成功", msg_err_keyframe: "只有上传视频序列后才能打关键帧哦！",
                msg_err_upload: "请先上传图片或视频！", msg_err_render: "生成失败，尝试调低分辨率。", msg_err_export_req: "请先上传视频文件再导出序列。", msg_err_export: "导出过程中断，请重试。",
                msg_save_preset: "保存预设", msg_enter_name: "请输入此配置的名称：", msg_err_cloud: "云端失败，已保存至本地。", msg_del_preset: "删除预设", msg_confirm_del: "确定要删除预设 ",
                msg_compressing: "正在压缩打包...", msg_engine: "引擎渲染中: ", btn_guide: "教程与原理", tip_guide: "阅读详细教程与原理解析",
                lbl_img_scale: "图片缩放", lbl_img_off_x: "水平偏移", lbl_img_off_y: "垂直偏移",
                lbl_extract: "边缘提取模式", opt_ext_auto: "自动识别 (推荐)", opt_ext_alpha: "按透明度 (去底图)", opt_ext_luma: "按亮度 (黑底图)",
                lbl_mask: "透镜遮罩 (局部露出)", lbl_mask_w: "光栅覆盖宽度", lbl_mask_h: "光栅覆盖高度", lbl_mask_x: "遮罩 X轴偏移", lbl_mask_y: "遮罩 Y轴偏移",
                lbl_blur: "高斯模糊发光扩散", lbl_sharp: "发光体清晰度", lbl_stripe: "长虹玻璃槽宽", lbl_disp: "折射扭曲度 (位移)", lbl_shading: "玻璃阴影衰减", lbl_noise: "胶片噪点质感",
                lbl_light_int: "发光光源亮度强度", opt_lut: "全局映射 (LUT)", opt_spatial: "空间光源 (一半一半)", lbl_col1: "主色彩 A", lbl_col2: "副色彩 B", lbl_angle: "交界角度", lbl_offset: "渐变色彩偏移", lbl_lut_cols: "全局映射色彩预设 (LUT Presets)",
                lut_p1: "经典蓝橙", lut_p2: "赛博朋克", lut_p3: "生化危机", lut_p4: "日落余晖", lut_p5: "极光幻境",
                lbl_login_svg: "登录解锁", lbl_unlocked_svg: "导出SVG文件", btn_svg: "SVG", login_title: "解锁账号功能", login_desc: "使用已验证的免费账号解锁无限图片导出和 SVG 下载。", btn_google_login: "使用 Google 继续", btn_email_login: "登录", btn_email_register: "创建免费账号", ph_email: "电子邮箱", ph_password: "密码", lbl_or: "或者", btn_login_header: "登录", btn_logout: "退出登录", btn_verify_email: "验证邮箱", tip_login: "登录或管理账号", msg_logged_out: "您已成功退出登录。",
                msg_auth_fields: "请输入邮箱和密码。", msg_auth_signing_in: "正在登录…", msg_auth_registering: "正在创建账号…", msg_auth_google_wait: "正在打开 Google 登录…", msg_auth_verify_sent: "验证邮件已发送，请先完成邮箱验证，再返回登录。", msg_auth_verify_required: "请先验证邮箱再解锁账号功能，新的验证邮件已经发送。",
                msg_auth_invalid_email: "请输入有效的电子邮箱。", msg_auth_invalid_credentials: "邮箱或密码不正确。", msg_auth_email_used: "该邮箱已经注册，请直接登录。", msg_auth_weak_password: "密码强度不足，请至少输入 6 个字符。", msg_auth_too_many: "尝试次数过多，请稍后再试。", msg_auth_network: "暂时无法连接认证服务，请检查网络后重试。", msg_auth_disabled: "当前登录方式尚未启用。", msg_auth_popup_blocked: "浏览器阻止了 Google 登录窗口，请允许弹窗后重试。", msg_auth_popup_closed: "已取消 Google 登录。", msg_auth_unauthorized_domain: "当前网站域名尚未获得 Google 登录授权。", msg_auth_provider_mismatch: "该邮箱使用了其他登录方式。", msg_auth_user_disabled: "该账号已被停用。", msg_auth_unknown: "登录失败，请稍后重试。",
                msg_auth_changed: "登录账号已经变化，请重新执行预设操作。", msg_preset_name_invalid: "预设名称需为 1–80 个字符，且不能包含斜杠。", msg_delete_cloud: "本地预设已删除，但云端删除失败。",
                msg_drop_here: "松开鼠标加载文件", msg_err_format: "仅支持图片或视频文件格式。"
            }
        };

        const t = (key) => translations[currentLang]?.[key] || translations.en[key] || key;

        // === 2. HELPER FUNCTIONS ===
        function hexToRgb(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
        }

        function formatTime(seconds) {
            if (isNaN(seconds)) return "0:00";
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }

        function downloadFile(data, extension, isText = false) {
            const link = document.createElement('a');
            link.style.display = 'none';
            let url;
            if (isText) {
                const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
                url = URL.createObjectURL(blob);
            } else {
                url = URL.createObjectURL(data);
            }
            link.href = url;
            link.download = `zyronmatrix_export_${Date.now()}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }

        function updateLutPreview() {
            const preview = document.getElementById('glassLutPreview');
            const glassLut1 = document.getElementById('glassLut1');
            const glassLut5 = document.getElementById('glassLut5');
            if(preview && glassLut1 && glassLut5) {
                preview.style.background = `linear-gradient(to right, ${glassLut1.value}, ${document.getElementById('glassLut2').value} 20%, ${document.getElementById('glassLut3').value} 50%, ${document.getElementById('glassLut4').value} 80%, ${glassLut5.value})`;
            }
        }

        function updateUIValues() {
            const gridSizeInput = document.getElementById('gridSizeInput');
            const gridSize = document.getElementById('gridSize');
            if(gridSizeInput && gridSize && document.activeElement !== gridSizeInput) gridSizeInput.value = parseFloat(gridSize.value).toFixed(1);

            const setValueText = (inputId, outputId, formatter = value => value) => {
                const input = document.getElementById(inputId);
                const output = document.getElementById(outputId);
                if (input && output) output.textContent = formatter(input.value);
            };

            setValueText('dotScale', 'dotScaleVal', value => Number.parseFloat(value).toFixed(2));
            setValueText('stuckiFactor', 'stuckiFactorVal');
            setValueText('ditherThreshold', 'ditherThresholdVal', value => Number.parseFloat(value).toFixed(2));
            setValueText('dotCutoff', 'dotCutoffVal', value => Number.parseFloat(value).toFixed(2));
            setValueText('sourceBrightness', 'sourceBrightnessVal');
            setValueText('sourceContrast', 'sourceContrastVal');
            setValueText('brightness', 'brightnessVal');
            setValueText('contrast', 'contrastVal');
            setValueText('fpsInput', 'fpsVal');
            setValueText('asciiRatio', 'asciiRatioVal', value => Number.parseFloat(value).toFixed(2));
            setValueText('asciiIntensity', 'asciiIntensityVal');
            setValueText('glassImgScale', 'glassImgScaleVal', value => `${Math.round(Number.parseFloat(value) * 100)}%`);
            setValueText('glassImgOffsetX', 'glassImgOffsetXVal', value => `${value}px`);
            setValueText('glassImgOffsetY', 'glassImgOffsetYVal', value => `${value}px`);
            setValueText('glassMaskW', 'glassMaskWVal', value => `${value}%`);
            setValueText('glassMaskH', 'glassMaskHVal', value => `${value}%`);
            setValueText('glassMaskX', 'glassMaskXVal', value => `${value}%`);
            setValueText('glassMaskY', 'glassMaskYVal', value => `${value}%`);
            setValueText('glassLight', 'glassLightVal', value => `${Number.parseFloat(value).toFixed(1)}x`);
            setValueText('glassAngle', 'glassAngleVal', value => `${value}°`);
            setValueText('glassOffset', 'glassOffsetVal', value => `${value}%`);
            setValueText('glassBlur', 'glassBlurVal', value => `${value}px`);
            setValueText('glassSharp', 'glassSharpVal', value => `${value}%`);
            setValueText('glassStripe', 'glassStripeVal', value => `${value}px`);
            setValueText('glassDisp', 'glassDispVal');
            setValueText('glassShading', 'glassShadingVal', value => `${Math.round(Number.parseFloat(value) * 100)}%`);
            setValueText('glassNoise', 'glassNoiseVal');

            updateLutPreview();
        }

        function initEmptyCanvas() {
            const halftoneCanvas = document.getElementById('halftoneCanvas');
            if (imageElement || videoElement || !halftoneCanvas) return;
            const container = document.getElementById('previewContainer');
            if(!container) return;
            const w = Math.max(10, container.clientWidth - 64);
            const h = Math.max(10, container.clientHeight - 64);
            halftoneCanvas.width = Math.max(800, w); halftoneCanvas.height = Math.max(600, h);
            const ctx = halftoneCanvas.getContext('2d');
            ctx.clearRect(0, 0, halftoneCanvas.width, halftoneCanvas.height);
            const txtColor = getComputedStyle(document.body).getPropertyValue('--text-muted').trim() || 'rgba(0,0,0,0.3)';
            ctx.fillStyle = txtColor; ctx.font = '900 32px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(t('no_file_preview'), halftoneCanvas.width / 2, halftoneCanvas.height / 2);
        }

        function setCloudStatus(statusKey) {
            const cloudStatus = document.getElementById('cloudStatus');
            if (!cloudStatus) return;
            cloudStatus.setAttribute('data-i18n', statusKey);
            cloudStatus.textContent = t(statusKey);
            const isSynced = statusKey === 'status_synced';
            const isError = statusKey === 'status_sync_err';
            cloudStatus.className = `text-[9px] ${isSynced ? 'text-[var(--accent)]' : isError ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]'} font-bold px-3 py-1 neu-inset rounded-full`;
        }

        function openLoginModal() {
            setAuthStatus();
            document.getElementById('loginModal')?.classList.remove('hidden');
            document.getElementById('loginModal')?.classList.add('flex');
            setTimeout(() => document.getElementById('authEmail')?.focus(), 50);
        }

        function closeLoginModal() {
            document.getElementById('loginModal')?.classList.add('hidden');
            document.getElementById('loginModal')?.classList.remove('flex');
            const password = document.getElementById('authPassword');
            if (password) password.value = '';
            setAuthStatus();
        }

        function setAuthStatus(message = '', tone = 'neutral') {
            const status = document.getElementById('authStatus');
            if (!status) return;
            status.textContent = message;
            status.className = `rounded-xl px-4 py-3 text-left text-[11px] font-black leading-relaxed ${message ? '' : 'hidden'} ${tone === 'error' ? 'text-[var(--danger)] bg-red-500/10' : 'text-[var(--accent)] bg-[var(--accent-glow)]'}`;
        }

        function showAuthError(error) {
            const message = t(authErrorTranslationKey(error));
            const loginModal = document.getElementById('loginModal');
            if (loginModal && !loginModal.classList.contains('hidden')) {
                setAuthStatus(message, 'error');
                return Promise.resolve();
            }
            return showModal({ title: t('msg_err'), message, hideCancel: true });
        }

        function setAuthButtonsDisabled(disabled) {
            ['authEmailBtn', 'authRegisterBtn', 'authGoogleBtn'].forEach(id => {
                const button = document.getElementById(id);
                if (button) {
                    button.disabled = disabled;
                    button.setAttribute('aria-disabled', String(disabled));
                    button.classList.toggle('opacity-60', disabled);
                    button.classList.toggle('cursor-wait', disabled);
                }
            });
            document.getElementById('authEmailForm')?.setAttribute('aria-busy', String(disabled));
        }

        function setExportControlsLocked(locked) {
            const controls = document.querySelectorAll('aside input, aside select, aside button, #videoControls input, #videoControls button, #headerUserBtn');
            controls.forEach(control => {
                if (locked) {
                    if (!exportControlStates.has(control)) exportControlStates.set(control, control.disabled);
                    control.disabled = true;
                } else if (exportControlStates.has(control)) {
                    control.disabled = exportControlStates.get(control);
                    exportControlStates.delete(control);
                }
            });
        }

        function updateLoginUI() {
            const svgLoginLabel = document.getElementById('svgLoginLabel');
            const pngLimitLabel = document.getElementById('pngLimitLabel');
            const headerLoginText = document.getElementById('headerLoginText');
            const userIconUnauth = document.getElementById('userIconUnauth');
            const userIconAuth = document.getElementById('userIconAuth');
            const headerUserBtn = document.getElementById('headerUserBtn');

            if (!authReady) {
                if(headerLoginText) headerLoginText.textContent = t('status_conn');
                if(headerUserBtn) headerUserBtn.title = t('status_conn');
            } else if (isProUser) {
                if(svgLoginLabel) { svgLoginLabel.textContent = t('lbl_unlocked_svg'); svgLoginLabel.classList.replace('text-[var(--text-dark)]', 'text-[var(--accent)]'); }
                if(pngLimitLabel) { pngLimitLabel.textContent = currentLang === 'zh' ? '图像导出 (无限次)' : 'IMAGE EXPORT (UNLIMITED)'; pngLimitLabel.classList.replace('text-[var(--text-dark)]', 'text-[var(--accent)]'); }
                userIconUnauth?.classList.add('hidden'); userIconAuth?.classList.remove('hidden');
                if(headerLoginText) headerLoginText.textContent = t('btn_logout');
                if(headerUserBtn) headerUserBtn.title = t('btn_logout');
            } else {
                const leftTxt = currentLang === 'zh' ? `图像导出 (剩余 ${freeExportsLeft} 次)` : `IMAGE EXPORTS (${freeExportsLeft} LEFT)`;
                if(pngLimitLabel) { pngLimitLabel.textContent = leftTxt; pngLimitLabel.classList.replace('text-[var(--accent)]', 'text-[var(--text-dark)]'); }
                if(svgLoginLabel) { svgLoginLabel.textContent = t('lbl_login_svg'); svgLoginLabel.classList.replace('text-[var(--accent)]', 'text-[var(--text-dark)]'); }
                userIconUnauth?.classList.remove('hidden'); userIconAuth?.classList.add('hidden');
                if(headerLoginText) headerLoginText.textContent = currentUser && !currentUser.isAnonymous && !currentUser.emailVerified ? t('btn_verify_email') : t('btn_login_header');
                if(headerUserBtn) headerUserBtn.title = t('tip_login');
            }
        }

        function applyI18n() {
            document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
            document.title = currentLang === 'zh'
                ? '免费图片与视频转 ASCII 艺术生成器 | ZYRONMATRIX'
                : 'Free Image & Video to ASCII Art Generator | ZYRONMATRIX';
            const langEnBtn = document.getElementById('langEnBtn');
            const langZhBtn = document.getElementById('langZhBtn');
            if (currentLang === 'en') { langEnBtn?.classList.add('text-[var(--accent)]'); langZhBtn?.classList.remove('text-[var(--accent)]'); }
            else { langZhBtn?.classList.add('text-[var(--accent)]'); langEnBtn?.classList.remove('text-[var(--accent)]'); }
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[currentLang]?.[key]) {
                    if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'email' || el.type === 'password')) el.placeholder = translations[currentLang][key];
                    else el.textContent = translations[currentLang][key];
                }
            });
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                if (translations[currentLang]?.[key]) el.title = translations[currentLang][key];
            });
            if(currentRenderMode === 'dot') {
                const el = document.getElementById('lblGridSize'); if(el) el.textContent = t('lbl_grid');
                const el2 = document.getElementById('lblDotScale'); if(el2) el2.textContent = t('lbl_scale');
            } else if(currentRenderMode === 'ascii') {
                const el = document.getElementById('lblGridSize'); if(el) el.textContent = translations[currentLang]['lbl_grid'].replace('圆点', '字符').replace('Dot', 'Char');
                const el2 = document.getElementById('lblDotScale'); if(el2) el2.textContent = t('lbl_scale_ascii');
            } else if(currentRenderMode === 'dither') {
                const el = document.getElementById('lblGridSize'); if(el) el.textContent = translations[currentLang]['lbl_grid'].replace('圆点', '像素').replace('Dot', 'Pixel');
                const el2 = document.getElementById('lblDotScale'); if(el2) el2.textContent = t('lbl_scale');
            }
            const mdDisplay = document.getElementById('modeDisplay');
            if (videoElement || imageElement) { if(mdDisplay) mdDisplay.textContent = isVideo ? t('status_video') : t('status_image'); }
            else initEmptyCanvas();
            updateLoginUI();
        }

        function updateDotStyleUI() {
            const dotStyleSelect = document.getElementById('dotStyleSelect');
            const customVolumetricControls = document.getElementById('customVolumetricControls');
            const solidColorControl = document.getElementById('solidColorControl');
            if(!dotStyleSelect) return;
            const style = dotStyleSelect.value;
            if (style === 'volumetric_custom') { customVolumetricControls?.classList.remove('hidden'); solidColorControl?.classList.add('hidden'); }
            else if (style === 'solid') { customVolumetricControls?.classList.add('hidden'); solidColorControl?.classList.remove('hidden'); }
            else { customVolumetricControls?.classList.add('hidden'); solidColorControl?.classList.add('hidden'); }
        }

        function updateGlassColorModeUI() {
            const glassColorMode = document.getElementById('glassColorMode');
            const glassModeSpatialBtn = document.getElementById('glassModeSpatial');
            const glassModeLutBtn = document.getElementById('glassModeLut');
            const glassSpatialControls = document.getElementById('glassSpatialControls');
            const glassLutControls = document.getElementById('glassLutControls');
            if(!glassColorMode) return;
            if (glassColorMode.value === 'spatial') {
                if(glassModeSpatialBtn) glassModeSpatialBtn.className = "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all neu-btn border-none shadow-sm text-[var(--accent)]";
                if(glassModeLutBtn) glassModeLutBtn.className = "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all text-[var(--text-muted)] hover:text-[var(--text-dark)]";
                glassSpatialControls?.classList.remove('hidden'); glassLutControls?.classList.add('hidden');
            } else {
                if(glassModeLutBtn) glassModeLutBtn.className = "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all neu-btn border-none shadow-sm text-[var(--accent)]";
                if(glassModeSpatialBtn) glassModeSpatialBtn.className = "flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all text-[var(--text-muted)] hover:text-[var(--text-dark)]";
                glassLutControls?.classList.remove('hidden'); glassSpatialControls?.classList.add('hidden');
            }
        }

        function setRenderMode(mode) {
            if (isExporting || isRasterExporting) return;
            currentRenderMode = mode;
            const modeDotBtn = document.getElementById('modeDotBtn');
            const modeAsciiBtn = document.getElementById('modeAsciiBtn');
            const modeDitherBtn = document.getElementById('modeDitherBtn');
            const modeGlassBtn = document.getElementById('modeGlassBtn');
            [modeDotBtn, modeAsciiBtn, modeDitherBtn, modeGlassBtn].forEach(btn => { btn?.classList.remove('active'); btn?.classList.add('text-[var(--text-muted)]'); });

            const mGeo = document.getElementById('matrixGeometryControls');
            const gGeo = document.getElementById('glassGeometryControls');
            const aCtrl = document.getElementById('asciiControls');
            const dGeo = document.getElementById('dotGeometryControls');
            const ditherGeo = document.getElementById('ditherGeometryControls');
            const mCol = document.getElementById('matrixColorControls');
            const gCol = document.getElementById('glassColorControls');
            const mFlt = document.getElementById('matrixFilterControls');
            const gPhy = document.getElementById('glassPhysicsControls');

            [mGeo, gGeo, aCtrl, dGeo, ditherGeo, mCol, gCol, mFlt, gPhy].forEach(el => el?.classList.add('hidden'));

            if (mode === 'dot') {
                modeDotBtn?.classList.add('active'); modeDotBtn?.classList.remove('text-[var(--text-muted)]');
                mGeo?.classList.remove('hidden'); dGeo?.classList.remove('hidden'); mCol?.classList.remove('hidden'); mFlt?.classList.remove('hidden');
            } else if (mode === 'ascii') {
                modeAsciiBtn?.classList.add('active'); modeAsciiBtn?.classList.remove('text-[var(--text-muted)]');
                mGeo?.classList.remove('hidden'); aCtrl?.classList.remove('hidden'); mCol?.classList.remove('hidden'); mFlt?.classList.remove('hidden');
            } else if (mode === 'dither') {
                modeDitherBtn?.classList.add('active'); modeDitherBtn?.classList.remove('text-[var(--text-muted)]');
                mGeo?.classList.remove('hidden'); ditherGeo?.classList.remove('hidden'); mCol?.classList.remove('hidden'); mFlt?.classList.remove('hidden');
            } else if (mode === 'glass') {
                modeGlassBtn?.classList.add('active'); modeGlassBtn?.classList.remove('text-[var(--text-muted)]');
                gGeo?.classList.remove('hidden'); gCol?.classList.remove('hidden'); gPhy?.classList.remove('hidden');
            }
            applyI18n(); updateDotStyleUI(); updateGlassColorModeUI();
            const ps = document.getElementById('presetSelect'); if(ps) ps.value = "";
            document.getElementById('deletePresetBtn')?.classList.add('hidden');
            if (!isVideo || (videoElement && videoElement.paused)) processFrame();
        }

        function setupCanvasDimensions(w, h) {
            const halftoneCanvas = document.getElementById('halftoneCanvas');
            if (!w || !h || !halftoneCanvas) return;
            const isFS = !!document.fullscreenElement || isCssFullscreen;
            const container = document.getElementById('previewContainer');
            const padding = isFS ? 0 : 64;
            const cw = Math.max(1, isFS ? window.innerWidth : container.clientWidth - padding);
            const ch = Math.max(1, isFS ? window.innerHeight : container.clientHeight - padding);
            const scale = Math.min(cw / w, ch / h);
            halftoneCanvas.width = Math.max(1, w * scale); halftoneCanvas.height = Math.max(1, h * scale);
        }

        function triggerResize() {
            if (imageElement || videoElement) {
                setupCanvasDimensions(isVideo ? videoElement.videoWidth : imageElement.width, isVideo ? videoElement.videoHeight : imageElement.height);
                processFrame();
            } else { initEmptyCanvas(); }
        }

        function updateTimeDisplay() {
            const td = document.getElementById('timeDisplay');
            if(!videoElement || !td) return;
            td.textContent = `${formatTime(videoElement.currentTime)} / ${formatTime(videoElement.duration)}`;
        }

        function updateKeyframeUI() {
            const kc = document.getElementById('keyframeContainer');
            if(!kc) return; kc.innerHTML = '';
            if (!videoElement) return;
            keyframes.forEach(k => {
                const pos = (k.time / videoElement.duration) * 100;
                const marker = document.createElement('div');
                marker.className = 'keyframe-marker'; marker.style.left = `${pos}%`;
                kc.appendChild(marker);
            });
        }

        function getVolumetricColor(lum, style) {
            let palette; let stops;
            const cDark = document.getElementById('customColorDark')?.value || '#000';
            const cMid = document.getElementById('customColorMid')?.value || '#0066ff';
            const cLight = document.getElementById('customColorLight')?.value || '#fff';
            if (style === 'volumetric_custom') { palette = [ hexToRgb(cDark), hexToRgb(cMid), hexToRgb(cLight) ]; stops = [0.0, 0.45, 0.80]; }
            else {
                const palettes = { 'volumetric_blue': [[0,0,0], [0,20,80], [160,200,255], [255,255,255]], 'volumetric_mono': [[0,0,0], [80,80,80], [180,180,180], [255,255,255]] };
                palette = palettes[style]; stops = [0.0, 0.25, 0.6, 1.0];
            }
            if (!palette) return null;
            lum = Math.max(0, Math.min(1, lum));
            let closestIdx = 0; let minDiff = Infinity;
            for (let i = 0; i < stops.length; i++) {
                let diff = Math.abs(lum - stops[i]); if (diff < minDiff) { minDiff = diff; closestIdx = i; }
            }
            return `rgb(${palette[closestIdx][0]},${palette[closestIdx][1]},${palette[closestIdx][2]})`;
        }

        // === 3. CORE RENDERING ALGORITHMS ===

        function generateGlass(targetCanvas, currentScale, source) {
            if(!targetCanvas) return;
            const ctx = targetCanvas.getContext('2d', { alpha: false });
            const procW = targetCanvas.width; const procH = targetCanvas.height;
            let tempCanvas = document.createElement('canvas'); tempCanvas.width = procW; tempCanvas.height = procH;
            let tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
            let fillStyle = 'white';
            const colMode = document.getElementById('glassColorMode')?.value || 'spatial';
            const lightInt = parseFloat(document.getElementById('glassLight')?.value || 1.2);
            if (colMode === 'spatial') {
                const spCol1 = document.getElementById('glassSpatial1')?.value || '#b500ff';
                const spCol2 = document.getElementById('glassSpatial2')?.value || '#00e5ff';
                const rad = ((parseFloat(document.getElementById('glassAngle')?.value || 135)) - 90) * Math.PI / 180;
                const diag = Math.sqrt(procW * procW + procH * procH);
                const shiftAmount = ((parseFloat(document.getElementById('glassOffset')?.value || 0)) / 100) * (diag / 2);
                const cx = procW / 2 + Math.cos(rad) * shiftAmount; const cy = procH / 2 + Math.sin(rad) * shiftAmount;
                const x1 = cx - Math.cos(rad) * (diag / 2); const y1 = cy - Math.sin(rad) * (diag / 2);
                const x2 = cx + Math.cos(rad) * (diag / 2); const y2 = cy + Math.sin(rad) * (diag / 2);
                const grad = tempCtx.createLinearGradient(x1, y1, x2, y2);
                grad.addColorStop(0, spCol1); grad.addColorStop(1, spCol2); fillStyle = grad;
            }
            const sW = source.videoWidth || source.width; const sH = source.videoHeight || source.height;
            const srcRatio = sW / sH; const dstRatio = procW / procH;
            let drawW = procW, drawH = procH; if (srcRatio > dstRatio) { drawH = procW / srcRatio; } else { drawW = procH * srcRatio; }
            const gScale = parseFloat(document.getElementById('glassImgScale')?.value || 1.0);
            drawW *= gScale; drawH *= gScale;
            const drawX = (procW - drawW) / 2 + ((parseFloat(document.getElementById('glassImgOffsetX')?.value || 0)) * currentScale);
            const drawY = (procH - drawH) / 2 + ((parseFloat(document.getElementById('glassImgOffsetY')?.value || 0)) * currentScale);
            tempCtx.drawImage(source, drawX, drawY, drawW, drawH);
            let isLumaExtract = (document.getElementById('glassExtract')?.value || 'auto') === 'luma';
            if ((document.getElementById('glassExtract')?.value || 'auto') === 'auto') {
                const checkCanvas = document.createElement('canvas'); checkCanvas.width = 64; checkCanvas.height = 64;
                const checkCtx = checkCanvas.getContext('2d', { willReadFrequently: true }); checkCtx.drawImage(source, 0, 0, 64, 64);
                const checkData = checkCtx.getImageData(0, 0, 64, 64).data;
                let hasTrans = false; for (let i = 3; i < checkData.length; i += 4) { if (checkData[i] < 250) { hasTrans = true; break; } }
                isLumaExtract = !hasTrans;
            }
            const imgData = tempCtx.getImageData(0, 0, procW, procH); const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                if (isLumaExtract) { const l = data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114; data[i] = 255; data[i+1] = 255; data[i+2] = 255; data[i+3] = l * (data[i+3] / 255); }
                else { data[i] = 255; data[i+1] = 255; data[i+2] = 255; }
            }
            tempCtx.putImageData(imgData, 0, 0);
            if (colMode === 'spatial') { tempCtx.globalCompositeOperation = 'source-in'; tempCtx.fillStyle = fillStyle; tempCtx.fillRect(0, 0, procW, procH); tempCtx.globalCompositeOperation = 'source-over'; }
            let baseCanvas = document.createElement('canvas'); baseCanvas.width = procW; baseCanvas.height = procH;
            let baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true }); baseCtx.fillStyle = 'black'; baseCtx.fillRect(0, 0, procW, procH);
            baseCtx.filter = `blur(${document.getElementById('glassBlur')?.value || 45}px)`; baseCtx.drawImage(tempCanvas, 0, 0); baseCtx.filter = 'none';
            let lutCanvas = document.createElement('canvas'); lutCanvas.width = 256; lutCanvas.height = 1;
            let lutCtx = lutCanvas.getContext('2d', { willReadFrequently: true });
            const gradLut = lutCtx.createLinearGradient(0, 0, 256, 0);
            gradLut.addColorStop(0, document.getElementById('glassLut1')?.value || '#000'); gradLut.addColorStop(0.15, document.getElementById('glassLut2')?.value || '#0a2db5');
            gradLut.addColorStop(0.45, document.getElementById('glassLut3')?.value || '#16a6d1'); gradLut.addColorStop(0.75, document.getElementById('glassLut4')?.value || '#f06d18'); gradLut.addColorStop(1, document.getElementById('glassLut5')?.value || '#fff');
            lutCtx.fillStyle = gradLut; lutCtx.fillRect(0, 0, 256, 1);
            const lutData = lutCtx.getImageData(0, 0, 256, 1).data;
            const baseData = baseCtx.getImageData(0, 0, procW, procH); const tempData = tempCtx.getImageData(0, 0, procW, procH).data; const outData = new ImageData(procW, procH);
            const mWidth = (procW * parseFloat(document.getElementById('glassMaskW')?.value || 100)) / 100;
            const mHeight = (procH * parseFloat(document.getElementById('glassMaskH')?.value || 100)) / 100;
            const maskCenterX = procW / 2 + (procW * parseFloat(document.getElementById('glassMaskX')?.value || 0)) / 100;
            const maskCenterY = procH / 2 + (procH * parseFloat(document.getElementById('glassMaskY')?.value || 0)) / 100;
            const mLeft = maskCenterX - mWidth / 2; const mRight = maskCenterX + mWidth / 2; const mTop = maskCenterY - mHeight / 2; const mBottom = maskCenterY + mHeight / 2;
            const stpW = parseFloat(document.getElementById('glassStripe')?.value || 24);
            const disp = parseFloat(document.getElementById('glassDisp')?.value || 15);
            const shd = parseFloat(document.getElementById('glassShading')?.value || 0.6);
            const nse = parseFloat(document.getElementById('glassNoise')?.value || 15);
            const shpFactor = (parseFloat(document.getElementById('glassSharp')?.value || 0)) / 100; const blrFactor = 1 - shpFactor;
            for (let y = 0; y < procH; y++) {
                for (let x = 0; x < procW; x++) {
                    const i = (y * procW + x) * 4; const inMask = x >= mLeft && x <= mRight && y >= mTop && y <= mBottom; const noiseVal = (Math.random() - 0.5) * nse;
                    if (!inMask) {
                        const alpha = tempData[i+3] / 255; let r, g, b;
                        if (colMode === 'lut') { const rb = Math.min(255, baseData.data[i] * lightInt); const li = Math.floor(rb) * 4; r = lutData[li]; g = lutData[li+1]; b = lutData[li+2]; }
                        else { r = Math.min(255, baseData.data[i] * lightInt); g = Math.min(255, baseData.data[i+1] * lightInt); b = Math.min(255, baseData.data[i+2] * lightInt); }
                        r = tempData[i] * alpha + r * (1 - alpha); g = tempData[i+1] * alpha + g * (1 - alpha); b = tempData[i+2] * alpha + b * (1 - alpha);
                        outData.data[i] = Math.min(255, Math.max(0, r + noiseVal)); outData.data[i+1] = Math.min(255, Math.max(0, g + noiseVal)); outData.data[i+2] = Math.min(255, Math.max(0, b + noiseVal)); outData.data[i+3] = 255;
                        continue;
                    }
                    let rx = x - maskCenterX; let phase = (((rx % stpW) + stpW) % stpW) / stpW;
                    const dx = Math.round(Math.sin(phase * Math.PI * 2) * disp);
                    let sampleX = Math.max(0, Math.min(procW - 1, x + dx)); const sampleI = (y * procW + sampleX) * 4;
                    const shadowFactor = 1 - (1 - ((Math.cos(phase * Math.PI * 2) + 1) / 2)) * shd;
                    if (colMode === 'lut') {
                        const rawBrightness = Math.min(255, (baseData.data[sampleI] * blrFactor + (tempData[sampleI] * (tempData[sampleI+3] / 255)) * shpFactor) * lightInt);
                        const finalBrightness = Math.min(255, Math.max(0, Math.floor(rawBrightness * shadowFactor)));
                        const lutIdx = finalBrightness * 4;
                        outData.data[i] = Math.min(255, Math.max(0, lutData[lutIdx] + noiseVal)); outData.data[i+1] = Math.min(255, Math.max(0, lutData[lutIdx+1] + noiseVal)); outData.data[i+2] = Math.min(255, Math.max(0, lutData[lutIdx+2] + noiseVal)); outData.data[i+3] = 255;
                    } else {
                        const alphaNorm = tempData[sampleI+3] / 255;
                        const mixR = baseData.data[sampleI] * blrFactor + (tempData[sampleI] * alphaNorm) * shpFactor;
                        const mixG = baseData.data[sampleI+1] * blrFactor + (tempData[sampleI+1] * alphaNorm) * shpFactor;
                        const mixB = baseData.data[sampleI+2] * blrFactor + (tempData[sampleI+2] * alphaNorm) * shpFactor;
                        outData.data[i] = Math.min(255, Math.max(0, Math.floor(Math.min(255, mixR * lightInt) * shadowFactor) + noiseVal));
                        outData.data[i+1] = Math.min(255, Math.max(0, Math.floor(Math.min(255, mixG * lightInt) * shadowFactor) + noiseVal));
                        outData.data[i+2] = Math.min(255, Math.max(0, Math.floor(Math.min(255, mixB * lightInt) * shadowFactor) + noiseVal));
                        outData.data[i+3] = 255;
                    }
                }
            }
            ctx.putImageData(outData, 0, 0);
        }

        const bayer8x8 = BAYER_8X8;

        function sampleGrid(source, procW, procH, currentScale, gridValue) {
            const sourceWidth = source.videoWidth || source.width;
            const sourceHeight = source.videoHeight || source.height;
            return gridSampler.sample(source, sourceWidth, sourceHeight, procW, procH, {
                mode: currentRenderMode,
                asciiRatio: parseFloat(document.getElementById('asciiRatio')?.value || 0.6),
                gridValue,
                currentScale,
                sourceBrightness: parseInt(document.getElementById('sourceBrightness')?.value || 0, 10),
                sourceContrast: parseInt(document.getElementById('sourceContrast')?.value || 0, 10),
                brightness: parseInt(document.getElementById('brightness')?.value || 20, 10),
                contrast: parseInt(document.getElementById('contrast')?.value || 20, 10),
                invertMapping: document.getElementById('invertMapping')?.checked ?? false,
                smooth: document.getElementById('smoothStep')?.checked ?? true,
                dotStyle: document.getElementById('dotStyleSelect')?.value || 'solid',
                dotCutoff: parseFloat(document.getElementById('dotCutoff')?.value || 0.05),
                ditherThreshold: parseFloat(document.getElementById('ditherThreshold')?.value || 0.5),
                ditherMethod: currentRenderMode === 'dither' ? (document.getElementById('ditherMethodSelect')?.value || 'stucki') : 'none',
                stuckiFactor: currentRenderMode === 'dither' ? parseFloat(document.getElementById('stuckiFactor')?.value || 100) / 100 : 0,
            });
        }

        // Halftone, ASCII & Dither Engine (Canvas)
        function generateHalftone(targetCanvas, currentScale, source, gridValue) {
            if(!targetCanvas) return;
            const ctx = targetCanvas.getContext('2d', { alpha: false });
            const procW = targetCanvas.width;
            const procH = targetCanvas.height;
            const bgC = document.getElementById('bgColor')?.value || '#000';
            ctx.fillStyle = bgC;
            ctx.fillRect(0, 0, procW, procH);

            const sample = sampleGrid(source, procW, procH, currentScale, gridValue);
            const { stepX, stepY, numCols, numRows, offsetX, offsetY, gridLuma, gridColorsR, gridColorsG, gridColorsB, cutoff, ditherMethod, dStyle } = sample;
            const maxRadiusScale = parseFloat(document.getElementById('dotScale')?.value || 0.85);
            const isDitherMode = currentRenderMode === 'dither';
            const isAsciiMode = currentRenderMode === 'ascii';
            const isDotMode = currentRenderMode === 'dot';
            const aLogic = document.getElementById('asciiLogicSelect')?.value || 'density';
            const aCharsRaw = document.getElementById('asciiCharsInput')?.value || ' ';
            const aIntensity = parseInt(document.getElementById('asciiIntensity')?.value || 1, 10);
            const isFixedSize = document.getElementById('fixedDotSize')?.checked ?? false;
            const squarePixels = isDitherMode ? (document.getElementById('ditherSquarePixels')?.checked ?? true) : false;
            let safeChars = aCharsRaw;
            if (isAsciiMode && aLogic === 'mask' && (document.getElementById('asciiRemoveSpaces')?.checked ?? true)) {
                safeChars = aCharsRaw.replace(/\s+/g, '');
                if (safeChars.length === 0) safeChars = 'MATRIX';
            }

            // Render the sampled grid.
            let textIdx = 0;
            for(let row = 0; row < numRows; row++) {
                for(let col = 0; col < numCols; col++) {
                    const gIdx = row * numCols + col;
                    let renderRatio = gridLuma[gIdx];

                    const centerX = offsetX + col * stepX + stepX / 2;
                    const centerY = offsetY + row * stepY + stepY / 2;

                    if (isDitherMode) {
                        let isDotActive = false;
                        if (ditherMethod === 'bayer') {
                            isDotActive = renderRatio > (bayer8x8[row % 8][col % 8] + (cutoff - 0.5));
                        } else if (ditherMethod === 'stucki') {
                            isDotActive = renderRatio === 1;
                        } else {
                            isDotActive = renderRatio > cutoff;
                        }

                        if (isDotActive) {
                            if (dStyle === 'original') { ctx.fillStyle = `rgb(${Math.round(gridColorsR[gIdx])}, ${Math.round(gridColorsG[gIdx])}, ${Math.round(gridColorsB[gIdx])})`; }
                            else if (dStyle.startsWith('volumetric')) { ctx.fillStyle = getVolumetricColor(1, dStyle); }
                            else { ctx.fillStyle = document.getElementById('dotColor')?.value || '#fff'; }

                            const size = stepY * maxRadiusScale;
                            if (squarePixels) {
                                ctx.fillRect(centerX - size/2, centerY - size/2, size, size);
                            } else {
                                ctx.beginPath(); ctx.arc(centerX, centerY, size/2, 0, Math.PI * 2); ctx.fill();
                            }
                        }
                    }
                    else if (isDotMode) {
                        const maxRadius = (stepY / 2) * maxRadiusScale;
                        const radius = isFixedSize ? (renderRatio > cutoff ? maxRadius : 0) : (renderRatio > cutoff ? maxRadius * renderRatio : 0);
                        if (radius > 0.3) {
                            if (dStyle === 'original') { ctx.fillStyle = `rgb(${Math.round(gridColorsR[gIdx])}, ${Math.round(gridColorsG[gIdx])}, ${Math.round(gridColorsB[gIdx])})`; }
                            else if (dStyle.startsWith('volumetric')) { ctx.fillStyle = getVolumetricColor(renderRatio, dStyle); }
                            else { ctx.fillStyle = document.getElementById('dotColor')?.value || '#fff'; }
                            ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI * 2); ctx.fill();
                        }
                    }
                    else if (isAsciiMode) {
                        let maskChar = ''; if (aLogic === 'mask') { maskChar = safeChars[textIdx % safeChars.length]; textIdx++; }
                        if (renderRatio > cutoff) {
                            if (dStyle === 'original') { ctx.fillStyle = `rgb(${Math.round(gridColorsR[gIdx])}, ${Math.round(gridColorsG[gIdx])}, ${Math.round(gridColorsB[gIdx])})`; }
                            else if (dStyle.startsWith('volumetric')) { ctx.fillStyle = getVolumetricColor(renderRatio, dStyle); }
                            else { ctx.fillStyle = document.getElementById('dotColor')?.value || '#fff'; }

                            const fontSize = stepY * maxRadiusScale * 1.2;
                            ctx.font = `900 ${fontSize}px "JetBrains Mono", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

                            if (aLogic === 'mask') {
                                if (maskChar !== ' ') {
                                    ctx.globalAlpha = Math.max(0, Math.min(1, renderRatio));
                                    for(let i = 0; i < aIntensity; i++) ctx.fillText(maskChar, centerX, centerY);
                                    ctx.globalAlpha = 1.0;
                                }
                            } else {
                                const charIdx = Math.floor(renderRatio * 0.999 * safeChars.length); const char = safeChars[charIdx];
                                if (char && char !== ' ') for(let i = 0; i < aIntensity; i++) ctx.fillText(char, centerX, centerY);
                            }
                        }
                    }
                }
            }
        }

        function exportVectorSVG() {
            const source = isVideo ? videoElement : imageElement;
            if(!source) { showModal({ title: t('msg_sys_notice'), message: t('msg_err_upload'), hideCancel: true }); return; }
            const resVal = document.getElementById('exportResolution')?.value || 'source';
            let exportW = isVideo ? videoElement.videoWidth : imageElement.width; let exportH = isVideo ? videoElement.videoHeight : imageElement.height;
            if (resVal !== 'source') [exportW, exportH] = resVal.split('x').map(Number);
            const currentScale = exportW / (isVideo ? videoElement.videoWidth : imageElement.width);
            const gridValue = isVideo ? getInterpolatedGridSize(videoElement.currentTime) : parseFloat(document.getElementById('gridSize')?.value || 20);

            if (currentRenderMode === 'glass') {
                const c = document.createElement('canvas'); c.width = exportW; c.height = exportH;
                generateGlass(c, currentScale, source);
                const b64 = c.toDataURL('image/png');
                const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${exportW} ${exportH}" width="${exportW}" height="${exportH}"><image href="${b64}" width="100%" height="100%" /></svg>`;
                downloadFile(svgStr, 'svg', true);
                return;
            }

            const procW = exportW;
            const procH = exportH;
            const sample = sampleGrid(source, procW, procH, currentScale, gridValue);
            const { stepX, stepY, numCols, numRows, offsetX, offsetY, gridLuma, gridColorsR, gridColorsG, gridColorsB, cutoff, ditherMethod, dStyle } = sample;
            const maxRadiusScale = parseFloat(document.getElementById('dotScale')?.value || 0.85);
            const isDitherMode = currentRenderMode === 'dither';
            const isAsciiMode = currentRenderMode === 'ascii';
            const isDotMode = currentRenderMode === 'dot';
            const aCharsRaw = document.getElementById('asciiCharsInput')?.value || ' ';
            const aLogic = document.getElementById('asciiLogicSelect')?.value || 'density';
            const aIntensity = parseInt(document.getElementById('asciiIntensity')?.value || 1, 10);
            const isFixedSize = document.getElementById('fixedDotSize')?.checked ?? false;
            const squarePixels = isDitherMode ? (document.getElementById('ditherSquarePixels')?.checked ?? true) : false;
            let safeChars = aCharsRaw;
            if (isAsciiMode && aLogic === 'mask' && (document.getElementById('asciiRemoveSpaces')?.checked ?? true)) {
                safeChars = aCharsRaw.replace(/\s+/g, '');
                if (safeChars.length === 0) safeChars = 'MATRIX';
            }
            const bgC = document.getElementById('bgColor')?.value || '#000000';

            let svgLines = [];
            svgLines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
            svgLines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${procW} ${procH}" width="${procW}" height="${procH}" style="background-color:${bgC};">`);
            svgLines.push(`<rect width="100%" height="100%" fill="${bgC}"/>`);
            if (isAsciiMode) svgLines.push(`<style>text{font-family:'JetBrains Mono','Courier New',Courier,monospace;font-weight:900;text-anchor:middle;dominant-baseline:central;}</style>`);

            let textIdx = 0;
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numCols; col++) {
                    const gIdx = row * numCols + col;
                    let renderRatio = gridLuma[gIdx];

                    const centerX = offsetX + col * stepX + stepX / 2;
                    const centerY = offsetY + row * stepY + stepY / 2;

                    if (isDitherMode) {
                        let isDotActive = false;
                        if (ditherMethod === 'bayer') {
                            isDotActive = renderRatio > (bayer8x8[row % 8][col % 8] + (cutoff - 0.5));
                        } else if (ditherMethod === 'stucki') {
                            isDotActive = renderRatio === 1;
                        } else {
                            isDotActive = renderRatio > cutoff;
                        }

                        if (isDotActive) {
                            let fillCol = document.getElementById('dotColor')?.value || '#fff';
                            if (dStyle === 'original') { fillCol = `rgb(${Math.round(gridColorsR[gIdx])},${Math.round(gridColorsG[gIdx])},${Math.round(gridColorsB[gIdx])})`; }
                            else if (dStyle.startsWith('volumetric')) { fillCol = getVolumetricColor(1, dStyle); }

                            const size = stepY * maxRadiusScale;
                            if (squarePixels) {
                                const sx = centerX - size/2; const sy = centerY - size/2;
                                svgLines.push(`<rect x="${sx.toFixed(1)}" y="${sy.toFixed(1)}" width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="${fillCol}"/>`);
                            } else {
                                svgLines.push(`<circle cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="${(size/2).toFixed(1)}" fill="${fillCol}"/>`);
                            }
                        }
                    } else if (isDotMode) {
                        const maxRadius = (stepY / 2) * maxRadiusScale;
                        let radius = isFixedSize ? (renderRatio > cutoff ? maxRadius : 0) : (renderRatio > cutoff ? maxRadius * renderRatio : 0);
                        if (radius > 0.3) {
                            let fillCol = document.getElementById('dotColor')?.value || '#fff';
                            if (dStyle === 'original') { fillCol = `rgb(${Math.round(gridColorsR[gIdx])},${Math.round(gridColorsG[gIdx])},${Math.round(gridColorsB[gIdx])})`; }
                            else if (dStyle.startsWith('volumetric')) { fillCol = getVolumetricColor(renderRatio, dStyle); }
                            svgLines.push(`<circle cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="${radius.toFixed(1)}" fill="${fillCol}"/>`);
                        }
                    } else if (isAsciiMode) {
                        let maskChar = ''; if (aLogic === 'mask') { maskChar = safeChars[textIdx % safeChars.length]; textIdx++; }
                        if (renderRatio > cutoff) {
                            let fillCol = document.getElementById('dotColor')?.value || '#fff';
                            if (dStyle === 'original') { fillCol = `rgb(${Math.round(gridColorsR[gIdx])},${Math.round(gridColorsG[gIdx])},${Math.round(gridColorsB[gIdx])})`; }
                            else if (dStyle.startsWith('volumetric')) { fillCol = getVolumetricColor(renderRatio, dStyle); }
                            const fontSize = stepY * maxRadiusScale * 1.2;

                            if (aLogic === 'mask') {
                                if (maskChar !== ' ') {
                                    let alpha = Math.max(0, Math.min(1, renderRatio));
                                    let xmlChar = maskChar.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                                    for(let i = 0; i < aIntensity; i++) svgLines.push(`<text x="${centerX.toFixed(1)}" y="${centerY.toFixed(1)}" font-size="${fontSize.toFixed(1)}px" fill="${fillCol}" opacity="${alpha.toFixed(2)}">${xmlChar}</text>`);
                                }
                            } else {
                                const charIdx = Math.floor(renderRatio * 0.999 * safeChars.length); const char = safeChars[charIdx];
                                if (char && char !== ' ') {
                                    let xmlChar = char.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
                                    for(let i = 0; i < aIntensity; i++) svgLines.push(`<text x="${centerX.toFixed(1)}" y="${centerY.toFixed(1)}" font-size="${fontSize.toFixed(1)}px" fill="${fillCol}">${xmlChar}</text>`);
                                }
                            }
                        }
                    }
                }
            }
            svgLines.push('</svg>');
            downloadFile(svgLines.join('\n'), 'svg', true);
        }

        function processFrame() {
            const halftoneCanvas = document.getElementById('halftoneCanvas');
            if (!imageElement && !videoElement) return;
            const source = isVideo ? videoElement : imageElement;
            if (!source || (isVideo && videoElement.readyState < 2)) return;
            const sourceWidth = isVideo ? videoElement.videoWidth : imageElement.width;
            let currentGridValue = parseFloat(document.getElementById('gridSize')?.value || 20);
            if (isVideo && keyframes.length > 0 && !isManuallyOverridingGrid) {
                currentGridValue = getInterpolatedGridSize(videoElement.currentTime);
                const gs = document.getElementById('gridSize'); if(gs) gs.value = currentGridValue;
                const gsi = document.getElementById('gridSizeInput'); if(gsi && document.activeElement !== gsi) gsi.value = currentGridValue.toFixed(1);
                document.getElementById('keyframeIndicator')?.classList.remove('hidden');
            } else { document.getElementById('keyframeIndicator')?.classList.add('hidden'); }
            const scaleCanvas = halftoneCanvas && sourceWidth > 0 ? (halftoneCanvas.width / sourceWidth) : 1;
            if (currentRenderMode === 'glass') { generateGlass(halftoneCanvas, scaleCanvas, source); }
            else { generateHalftone(halftoneCanvas, scaleCanvas, source, currentGridValue); }
            if (isVideo && !isScrubbing && videoElement) {
                const vs = document.getElementById('videoScrubber'); if(vs) vs.value = (videoElement.currentTime / videoElement.duration) * 100 || 0;
                updateTimeDisplay();
            }
        }

        function getInterpolatedGridSize(time) {
            if (keyframes.length === 0) return parseFloat(document.getElementById('gridSize')?.value || 20);
            const sorted = [...keyframes].sort((a, b) => a.time - b.time);
            if (time <= sorted[0].time) return sorted[0].value;
            if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value;
            for (let i = 0; i < sorted.length - 1; i++) {
                const start = sorted[i]; const end = sorted[i+1];
                if (time >= start.time && time <= end.time) {
                    const t = (time - start.time) / (end.time - start.time);
                    return start.value + (end.value - start.value) * t;
                }
            }
            return parseFloat(document.getElementById('gridSize')?.value || 20);
        }

        function stopVideoFrameLoop() {
            videoFrameScheduler.stop();
        }

        function startVideoFrameLoop() {
            if (!isVideo || !videoElement || videoElement.paused || isExporting) return;
            const frameVideo = videoElement;
            videoFrameScheduler.start(
                frameVideo,
                () => isVideo && videoElement === frameVideo && !frameVideo.paused && !isExporting,
                () => processFrame(),
                (error) => console.error('Video frame render error:', error),
            );
        }

        function renderRasterFormat(format) {
            if (isRasterExporting || isExporting) return;
            const source = isVideo ? videoElement : imageElement;
            if(!source) { showModal({ title: t('msg_sys_notice'), message: t('msg_err_upload'), hideCancel: true }); return; }
            const sourceWidth = isVideo ? videoElement.videoWidth : imageElement.width;
            const sourceHeight = isVideo ? videoElement.videoHeight : imageElement.height;
            if (!sourceWidth || !sourceHeight || (isVideo && videoElement.readyState < 2)) {
                showModal({ title: t('msg_sys_notice'), message: t('msg_err_upload'), hideCancel: true });
                return;
            }
            if (!isProUser && freeExportsLeft <= 0) { openLoginModal(); return; }
            const shouldChargeFreeExport = !isProUser;
            isRasterExporting = true;
            setExportControlsLocked(true);
            try {
                const c = document.createElement('canvas');
                const resVal = document.getElementById('exportResolution')?.value || 'source';
                let exportW = sourceWidth; let exportH = sourceHeight;
                if (resVal !== 'source') [exportW, exportH] = resVal.split('x').map(Number);
                c.width = exportW; c.height = exportH;
                const scale = exportW / sourceWidth;
                if (currentRenderMode === 'glass') { generateGlass(c, scale, source); }
                else { generateHalftone(c, scale, source, isVideo ? getInterpolatedGridSize(videoElement.currentTime) : (parseFloat(document.getElementById('gridSize')?.value || 20))); }
                c.toBlob((blob) => {
                    try {
                        if (!blob) { showModal({ title: t('msg_err'), message: t('msg_err_render'), hideCancel: true }); return; }
                        downloadFile(blob, format === 'jpeg' ? 'jpg' : 'png');
                        if (shouldChargeFreeExport) {
                            freeExportsLeft = Math.max(0, freeExportsLeft - 1);
                            appStorage.setItem('matrix_ui_free_exports_left', String(freeExportsLeft));
                            updateLoginUI();
                        }
                    } finally {
                        isRasterExporting = false;
                        setExportControlsLocked(false);
                    }
                }, `image/${format}`, format === 'jpeg' ? 0.95 : undefined);
            } catch (error) {
                isRasterExporting = false;
                setExportControlsLocked(false);
                console.error(error);
                showModal({ title: t('msg_err'), message: t('msg_err_render'), hideCancel: true });
            }
        }

        function updatePresetDropdown() {
            const presetSelect = document.getElementById('presetSelect'); if(!presetSelect) return;
            const currentSelection = presetSelect.value;
            presetSelect.innerHTML = `<option value="">${t('opt_custom_preset')}</option>`;
            for (const name in userPresets) { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; presetSelect.appendChild(opt); }
            if (userPresets[currentSelection]) presetSelect.value = currentSelection;
        }
        function loadLocalPresets(uid = currentUser?.uid) { userPresets = readPresets(appStorage, uid); updatePresetDropdown(); }
        function persistLocalPresets(uid = currentUser?.uid) { writePresets(appStorage, userPresets, uid); }

        function applyPreset(preset) {
            if (!preset || typeof preset !== 'object') return;
            const valueIds = {
                gridSize: 'gridSize', dotScale: 'dotScale', sourceBrightness: 'sourceBrightness', sourceContrast: 'sourceContrast',
                brightness: 'brightness', contrast: 'contrast', fpsInput: 'fpsInput', dotCutoff: 'dotCutoff', ditherThreshold: 'ditherThreshold',
                stuckiFactor: 'stuckiFactor', asciiRatio: 'asciiRatio', asciiIntensity: 'asciiIntensity', glassImgScale: 'glassImgScale',
                glassImgOffsetX: 'glassImgOffsetX', glassImgOffsetY: 'glassImgOffsetY', glassMaskW: 'glassMaskW', glassMaskH: 'glassMaskH',
                glassMaskX: 'glassMaskX', glassMaskY: 'glassMaskY', glassLight: 'glassLight', glassAngle: 'glassAngle', glassOffset: 'glassOffset',
                glassBlur: 'glassBlur', glassSharp: 'glassSharp', glassStripe: 'glassStripe', glassDisp: 'glassDisp', glassShading: 'glassShading',
                glassNoise: 'glassNoise', bgColor: 'bgColor', dotColor: 'dotColor', ditherMethod: 'ditherMethodSelect', asciiLogic: 'asciiLogicSelect',
                dotStyle: 'dotStyleSelect', customColorDark: 'customColorDark', customColorMid: 'customColorMid', customColorLight: 'customColorLight',
                asciiCharsInput: 'asciiCharsInput', glassExtract: 'glassExtract', glassColorMode: 'glassColorMode', glassSpatial1: 'glassSpatial1',
                glassSpatial2: 'glassSpatial2', glassLut1: 'glassLut1', glassLut2: 'glassLut2', glassLut3: 'glassLut3', glassLut4: 'glassLut4', glassLut5: 'glassLut5'
            };
            Object.entries(valueIds).forEach(([presetKey, elementId]) => {
                if (preset[presetKey] === undefined) return;
                const element = document.getElementById(elementId);
                if (element) element.value = String(preset[presetKey]);
            });
            ['invertMapping', 'smoothStep', 'fixedDotSize', 'asciiRemoveSpaces', 'ditherSquarePixels'].forEach(id => {
                const element = document.getElementById(id);
                if (element && preset[id] !== undefined) element.checked = Boolean(preset[id]);
            });
            if (preset.renderMode) setRenderMode(preset.renderMode);
            isManuallyOverridingGrid = false;
            const asciiPresetSelect = document.getElementById('asciiPresetSelect');
            const asciiCharsInput = document.getElementById('asciiCharsInput');
            if (asciiPresetSelect && asciiCharsInput) {
                const hasMatchingPreset = Array.from(asciiPresetSelect.options).some(option => option.value === asciiCharsInput.value);
                asciiPresetSelect.value = hasMatchingPreset ? asciiCharsInput.value : 'custom';
            }
            updateDotStyleUI();
            updateGlassColorModeUI();
            updateUIValues();
            const selectedPreset = document.getElementById('presetSelect');
            if (selectedPreset?.value) document.getElementById('deletePresetBtn')?.classList.remove('hidden');
            if (!isVideo || videoElement?.paused) processFrame();
        }

        function showModal({ title = t('msg_sys_notice'), message, showInput = false, hideCancel = false }) {
            const mt = document.getElementById('modalTitle'), mm = document.getElementById('modalMessage'), mi = document.getElementById('modalInput'), mc = document.getElementById('modalCancel'), mconf = document.getElementById('modalConfirm'), cm = document.getElementById('customModal');
            return new Promise((resolve) => {
                if(mt) mt.textContent = title; if(mm) mm.textContent = message;
                if(showInput && mi) { mi.classList.remove('hidden'); mi.value = ''; setTimeout(() => mi.focus(), 50); } else { mi?.classList.add('hidden'); }
                if(hideCancel) mc?.classList.add('hidden'); else mc?.classList.remove('hidden');
                cm?.classList.remove('hidden'); cm?.classList.add('flex');
                const cleanup = () => { mconf?.removeEventListener('click', onConfirm); mc?.removeEventListener('click', onCancel); };
                const close = (result) => { cleanup(); cm?.classList.add('hidden'); cm?.classList.remove('flex'); resolve(result); };
                const onConfirm = () => close(showInput ? mi?.value.trim() : true);
                const onCancel = () => close(null);
                mconf?.addEventListener('click', onConfirm);
                mc?.addEventListener('click', onCancel);
            });
        }

        // --- NEW: MEDIA FILE HANDLER FOR REUSE ---
        function handleMediaFile(file) {
            if (!file) return;
            if (!file.type.startsWith('video/') && !file.type.startsWith('image/')) {
                showModal({ title: t('msg_sys_notice'), message: t('msg_err_format'), hideCancel: true });
                return;
            }
            const fnDisplay = document.getElementById('fileNameDisplay');
            if(fnDisplay) { fnDisplay.removeAttribute('data-i18n'); fnDisplay.textContent = file.name; }
            stopVideoFrameLoop();
            const previousVideo = videoElement;
            if (previousVideo) { previousVideo.pause(); previousVideo.removeAttribute('src'); previousVideo.load(); }
            videoElement = null;
            if (currentMediaUrl) URL.revokeObjectURL(currentMediaUrl);
            const url = URL.createObjectURL(file);
            currentMediaUrl = url;
            const generation = ++mediaGeneration;
            const clearFailedMedia = () => {
                if (generation !== mediaGeneration) return;
                stopVideoFrameLoop();
                if (currentMediaUrl) URL.revokeObjectURL(currentMediaUrl);
                currentMediaUrl = null;
                imageElement = null;
                videoElement = null;
                isVideo = false;
                document.getElementById('videoControls')?.classList.add('hidden');
                const rd = document.getElementById('resDisplay'); if (rd) rd.textContent = '-';
                const md = document.getElementById('modeDisplay'); if (md) md.textContent = '-';
                if (fnDisplay) { fnDisplay.setAttribute('data-i18n', 'no_file'); fnDisplay.textContent = t('no_file'); }
                initEmptyCanvas();
                showModal({ title: t('msg_err'), message: t('msg_err_format'), hideCancel: true });
            };
            if (file.type.startsWith('video/')) {
                isVideo = true; imageElement = null;
                const md = document.getElementById('modeDisplay'); if(md) md.textContent = t('status_video');
                document.getElementById('videoControls')?.classList.remove('hidden');
                const mediaVideo = document.createElement('video');
                mediaVideo.muted = true; mediaVideo.playsInline = true; mediaVideo.loop = true; mediaVideo.crossOrigin = "anonymous"; mediaVideo.autoplay = true;
                videoElement = mediaVideo;
                mediaVideo.addEventListener('seeked', () => { if (videoElement === mediaVideo && mediaVideo.paused && !isExporting) processFrame(); });
                mediaVideo.addEventListener('play', () => { if (videoElement !== mediaVideo) return; document.getElementById('playIcon')?.classList.add('hidden'); document.getElementById('pauseIcon')?.classList.remove('hidden'); startVideoFrameLoop(); });
                mediaVideo.addEventListener('pause', () => { if (videoElement !== mediaVideo) return; document.getElementById('playIcon')?.classList.remove('hidden'); document.getElementById('pauseIcon')?.classList.add('hidden'); stopVideoFrameLoop(); });
                mediaVideo.src = url;
                mediaVideo.onloadedmetadata = () => {
                    if (generation !== mediaGeneration || videoElement !== mediaVideo) return;
                    const rd = document.getElementById('resDisplay'); if(rd) rd.textContent = `${mediaVideo.videoWidth} x ${mediaVideo.videoHeight}`;
                    setupCanvasDimensions(mediaVideo.videoWidth, mediaVideo.videoHeight); processFrame(); mediaVideo.play().catch(() => {}); keyframes = []; updateKeyframeUI();
                };
                mediaVideo.onerror = clearFailedMedia;
            } else if (file.type.startsWith('image/')) {
                isVideo = false; videoElement = null; document.getElementById('videoControls')?.classList.add('hidden');
                const md = document.getElementById('modeDisplay'); if(md) md.textContent = t('status_image');
                imageElement = new Image(); imageElement.src = url;
                imageElement.onload = () => { if (generation !== mediaGeneration) return; const rd = document.getElementById('resDisplay'); if(rd) rd.textContent = `${imageElement.width} x ${imageElement.height}`; setupCanvasDimensions(imageElement.width, imageElement.height); processFrame(); };
                imageElement.onerror = clearFailedMedia;
            }
        }

        // === 3. INITIALIZATION AND EVENT BINDING ===
        function connectFirebase() {
            if (firebaseConnectionPromise) return firebaseConnectionPromise;
            firebaseConnectionPromise = (async () => {
              try {
                const services = await loadFirebaseServices();
                firebaseServices = services;
                const { auth, db, authApi, firestoreApi } = services;
                if (unsubscribeAuth) unsubscribeAuth();
                await new Promise((resolve) => {
                  let waitingForInitialState = true;
                  const initialStateTimeout = window.setTimeout(() => {
                    authReady = true;
                    setCloudStatus('status_local');
                    updateLoginUI();
                    finishInitialState();
                  }, 10000);
                  const finishInitialState = () => {
                    if (!waitingForInitialState) return;
                    waitingForInitialState = false;
                    window.clearTimeout(initialStateTimeout);
                    resolve();
                  };
                  unsubscribeAuth = authApi.onIdTokenChanged(auth, (user) => {
                    const subscriptionGeneration = ++presetSubscriptionGeneration;
                    authGeneration += 1;
                    if (unsubscribePresets) {
                      unsubscribePresets();
                      unsubscribePresets = null;
                    }
                    currentUser = user;
                    isProUser = hasVerifiedAccountAccess(user);
                    authReady = true;
                    updateLoginUI();
                    if (isProUser) {
                      setCloudStatus('status_conn');
                      const subscribedUid = user.uid;
                      unsubscribePresets = firestoreApi.onSnapshot(firestoreApi.collection(db, 'artifacts', currentAppId, 'users', subscribedUid, 'presets'), (snapshot) => {
                        if (subscriptionGeneration !== presetSubscriptionGeneration || currentUser?.uid !== subscribedUid) return;
                        const cloudPresets = {};
                        snapshot.forEach(snapshotDoc => cloudPresets[snapshotDoc.id] = snapshotDoc.data());
                        userPresets = cloudPresets;
                        writePresets(appStorage, cloudPresets, subscribedUid);
                        updatePresetDropdown();
                        setCloudStatus('status_synced');
                      }, () => {
                        if (subscriptionGeneration !== presetSubscriptionGeneration || currentUser?.uid !== subscribedUid) return;
                        setCloudStatus('status_sync_err');
                        loadLocalPresets(subscribedUid);
                      });
                    } else {
                      setCloudStatus('status_local');
                      loadLocalPresets(user?.uid ?? null);
                    }
                    finishInitialState();
                  }, () => {
                    currentUser = null;
                    isProUser = false;
                    authReady = true;
                    setCloudStatus('status_local');
                    loadLocalPresets(null);
                    updateLoginUI();
                    finishInitialState();
                  });
                });
              } catch (error) {
                console.warn('Firebase unavailable; continuing in local mode.', error);
                if (unsubscribeAuth) unsubscribeAuth();
                unsubscribeAuth = null;
                firebaseServices = null;
                firebaseConnectionPromise = null;
                currentUser = null;
                isProUser = false;
                authReady = true;
                loadLocalPresets(null);
                setCloudStatus('status_local');
                updateLoginUI();
              }
            })();
            return firebaseConnectionPromise;
        }

        function initApp() {
            const storedTheme = appStorage.getItem('matrix_ui_theme');
            const useDarkTheme = storedTheme === 'dark';
            document.body.classList.toggle('dark-mode', useDarkTheme);
            document.getElementById('themeIconSun')?.classList.toggle('hidden', useDarkTheme);
            document.getElementById('themeIconMoon')?.classList.toggle('hidden', !useDarkTheme);
            loadLocalPresets();

            // Base Initialization
            applyI18n();
            setRenderMode('dot');
            triggerResize();
            setCloudStatus('status_conn');
            void connectFirebase();
            window.addEventListener('resize', triggerResize);
            window.addEventListener('beforeunload', () => {
                stopVideoFrameLoop();
                if (currentMediaUrl) URL.revokeObjectURL(currentMediaUrl);
                if (unsubscribePresets) unsubscribePresets();
                if (unsubscribeAuth) unsubscribeAuth();
                exportAbortController?.abort();
            });

            // Bind Event Listeners
            document.getElementById('modeDotBtn')?.addEventListener('click', () => setRenderMode('dot'));
            document.getElementById('modeAsciiBtn')?.addEventListener('click', () => setRenderMode('ascii'));
            document.getElementById('modeDitherBtn')?.addEventListener('click', () => setRenderMode('dither'));
            document.getElementById('modeGlassBtn')?.addEventListener('click', () => setRenderMode('glass'));
            document.getElementById('presetSelect')?.addEventListener('change', (event) => {
                const presetName = event.target.value;
                if (!presetName || !userPresets[presetName]) {
                    document.getElementById('deletePresetBtn')?.classList.add('hidden');
                    return;
                }
                applyPreset(userPresets[presetName]);
                event.target.value = presetName;
                document.getElementById('deletePresetBtn')?.classList.remove('hidden');
            });

            document.getElementById('dotStyleSelect')?.addEventListener('change', () => { updateDotStyleUI(); const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });
            document.getElementById('glassColorMode')?.addEventListener('change', () => { updateGlassColorModeUI(); const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });

            document.getElementById('ditherMethodSelect')?.addEventListener('change', (e) => {
                const sfCtrl = document.getElementById('stuckiFactorControl');
                if (e.target.value === 'stucki') {
                    sfCtrl?.classList.remove('hidden');
                } else {
                    sfCtrl?.classList.add('hidden');
                }

                // Auto-adjust threshold for dithering to prevent blown-out image if cutoff is too low
                if (e.target.value === 'stucki' || e.target.value === 'bayer') {
                    const dt = document.getElementById('ditherThreshold');
                    if (dt && parseFloat(dt.value) < 0.2) {
                        dt.value = 0.50;
                        updateUIValues();
                    }
                }

                const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); if (!isVideo || (videoElement && videoElement.paused)) processFrame();
            });

            document.getElementById('glassModeLut')?.addEventListener('click', () => { const el = document.getElementById('glassColorMode'); if(el) { el.value = 'lut'; el.dispatchEvent(new Event('change')); }});
            document.getElementById('glassModeSpatial')?.addEventListener('click', () => { const el = document.getElementById('glassColorMode'); if(el) { el.value = 'spatial'; el.dispatchEvent(new Event('change')); }});

            ['dotScale', 'stuckiFactor', 'ditherThreshold', 'sourceBrightness', 'sourceContrast', 'brightness', 'contrast', 'bgColor', 'dotColor', 'customColorDark', 'customColorMid', 'customColorLight', 'dotCutoff', 'fpsInput', 'asciiRatio', 'asciiIntensity',
             'glassImgScale', 'glassImgOffsetX', 'glassImgOffsetY', 'glassExtract', 'glassMaskW', 'glassMaskH', 'glassMaskX', 'glassMaskY', 'glassLight', 'glassSpatial1', 'glassSpatial2', 'glassAngle', 'glassOffset', 'glassLut1', 'glassLut2', 'glassLut3', 'glassLut4', 'glassLut5', 'glassBlur', 'glassSharp', 'glassStripe', 'glassDisp', 'glassShading', 'glassNoise'
            ].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => { const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); updateUIValues(); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });
            });

            ['invertMapping', 'smoothStep', 'fixedDotSize', 'asciiRemoveSpaces', 'ditherSquarePixels'].forEach(id => {
                document.getElementById(id)?.addEventListener('change', () => { const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });
            });

            document.getElementById('asciiLogicSelect')?.addEventListener('change', (e) => {
                const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden');
                const aci = document.getElementById('asciiCharsInput');
                if (e.target.value === 'mask' && aci && aci.value.length < 20) {
                    aci.value = "THE OCEAN, WITH ITS VAST EXPANSE AND MYSTERIOUS ALLURE, HAS ALWAYS HELD A SPECIAL PLACE IN HUMAN HEARTS. ";
                    const aps = document.getElementById('asciiPresetSelect'); if(aps) aps.value = "custom";
                }
                if (!isVideo || (videoElement && videoElement.paused)) processFrame();
            });

            document.getElementById('asciiPresetSelect')?.addEventListener('change', (e) => {
                if (e.target.value !== 'custom') { const aci = document.getElementById('asciiCharsInput'); if(aci) aci.value = e.target.value; const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); }
            });

            document.getElementById('asciiCharsInput')?.addEventListener('input', () => { const aps = document.getElementById('asciiPresetSelect'); if(aps) aps.value = 'custom'; const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });

            document.getElementById('gridSize')?.addEventListener('input', (e) => { isManuallyOverridingGrid = true; const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); const gsi = document.getElementById('gridSizeInput'); if(gsi) gsi.value = parseFloat(e.target.value).toFixed(1); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });
            document.getElementById('gridSizeInput')?.addEventListener('input', (e) => { isManuallyOverridingGrid = true; const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); let val = parseFloat(e.target.value); if (!isNaN(val)) { const gs = document.getElementById('gridSize'); if(gs) { val = Math.max(parseFloat(gs.min), Math.min(parseFloat(gs.max), val)); gs.value = String(val); e.target.value = String(val); } if (!isVideo || (videoElement && videoElement.paused)) processFrame(); } });

            document.getElementById('langEnBtn')?.addEventListener('click', () => { currentLang = 'en'; appStorage.setItem('matrix_ui_lang', currentLang); applyI18n(); });
            document.getElementById('langZhBtn')?.addEventListener('click', () => { currentLang = 'zh'; appStorage.setItem('matrix_ui_lang', currentLang); applyI18n(); });

            document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode'); appStorage.setItem('matrix_ui_theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
                document.getElementById('themeIconSun')?.classList.toggle('hidden'); document.getElementById('themeIconMoon')?.classList.toggle('hidden');
                if (!imageElement && !videoElement) initEmptyCanvas();
            });

            document.getElementById('headerUserBtn')?.addEventListener('click', async () => {
                if (!authReady) { await connectFirebase(); return; }
                if (isProUser && firebaseServices) {
                    try {
                        await firebaseServices.authApi.signOut(firebaseServices.auth);
                        await showModal({ title: t('msg_sys_notice'), message: t('msg_logged_out'), hideCancel: true });
                    } catch (error) {
                        await showAuthError(error);
                    }
                    return;
                }
                openLoginModal();
            });
            document.getElementById('loginCancelBtn')?.addEventListener('click', closeLoginModal);

            document.getElementById('authGoogleBtn')?.addEventListener('click', async () => {
                setAuthStatus(t('msg_auth_google_wait'));
                setAuthButtonsDisabled(true);
                try {
                    await connectFirebase();
                    const services = firebaseServices;
                    if (!services) throw { code: 'auth/network-request-failed' };
                    const googleProvider = new services.authApi.GoogleAuthProvider();
                    const credential = await services.authApi.signInWithPopup(services.auth, googleProvider);
                    if (!hasVerifiedAccountAccess(credential.user)) {
                        await services.authApi.signOut(services.auth);
                        throw { code: 'auth/invalid-credential' };
                    }
                    closeLoginModal();
                } catch(error) {
                    await showAuthError(error);
                } finally {
                    setAuthButtonsDisabled(false);
                }
            });

            const readAuthFields = () => ({
                email: document.getElementById('authEmail')?.value.trim() ?? '',
                password: document.getElementById('authPassword')?.value ?? '',
            });
            ['authEmail', 'authPassword'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => setAuthStatus());
            });

            document.getElementById('authEmailForm')?.addEventListener('submit', async (event) => {
                event.preventDefault();
                const { email, password } = readAuthFields();
                if (!email || !password) { setAuthStatus(t('msg_auth_fields'), 'error'); return; }
                setAuthStatus(t('msg_auth_signing_in'));
                setAuthButtonsDisabled(true);
                try {
                    await connectFirebase();
                    const services = firebaseServices;
                    if (!services) throw { code: 'auth/network-request-failed' };
                    const credential = await services.authApi.signInWithEmailAndPassword(services.auth, email, password);
                    await services.authApi.reload(credential.user);
                    if (!hasVerifiedAccountAccess(credential.user)) {
                        try { await services.authApi.sendEmailVerification(credential.user); } finally { await services.authApi.signOut(services.auth); }
                        closeLoginModal();
                        await showModal({ title: t('msg_sys_notice'), message: t('msg_auth_verify_required'), hideCancel: true });
                        return;
                    }
                    await credential.user.getIdToken(true);
                    closeLoginModal();
                } catch(error) {
                    await showAuthError(error);
                } finally {
                    setAuthButtonsDisabled(false);
                }
            });

            document.getElementById('authRegisterBtn')?.addEventListener('click', async () => {
                const { email, password } = readAuthFields();
                if (!email || !password) { setAuthStatus(t('msg_auth_fields'), 'error'); return; }
                setAuthStatus(t('msg_auth_registering'));
                setAuthButtonsDisabled(true);
                try {
                    await connectFirebase();
                    const services = firebaseServices;
                    if (!services) throw { code: 'auth/network-request-failed' };
                    const credential = await services.authApi.createUserWithEmailAndPassword(services.auth, email, password);
                    try { await services.authApi.sendEmailVerification(credential.user); } finally { await services.authApi.signOut(services.auth); }
                    closeLoginModal();
                    await showModal({ title: t('msg_sys_notice'), message: t('msg_auth_verify_sent'), hideCancel: true });
                } catch(error) {
                    await showAuthError(error);
                } finally {
                    setAuthButtonsDisabled(false);
                }
            });

            document.getElementById('exportSvgBtn')?.addEventListener('click', () => { if (isExporting || isRasterExporting) return; if (!isProUser) { openLoginModal(); return; } exportVectorSVG(); });
            document.getElementById('exportPngBtn')?.addEventListener('click', () => renderRasterFormat('png'));
            document.getElementById('exportJpgBtn')?.addEventListener('click', () => renderRasterFormat('jpeg'));

            document.getElementById('exportSequence')?.addEventListener('click', async () => {
                if (isExporting || isRasterExporting) return;
                if (!isProUser) {
                    openLoginModal();
                    return;
                }
                if (!videoElement || !isVideo || videoElement.readyState < 2 || !videoElement.videoWidth || !videoElement.videoHeight || !Number.isFinite(videoElement.duration) || videoElement.duration <= 0) { showModal({ message: t('msg_err_export_req'), hideCancel: true }); return; }
                const exportVideo = videoElement;
                const resumeAfterExport = !exportVideo.paused;
                const exportRenderMode = currentRenderMode;
                const abortController = new AbortController();
                exportAbortController = abortController;
                isExporting = true; exportVideo.pause(); setExportControlsLocked(true);
                const exportOverlay = document.getElementById('exportOverlay'); if(exportOverlay) exportOverlay.style.display = 'flex';
                const exportTitle = document.getElementById('exportTitle'); if (exportTitle) exportTitle.textContent = t('modal_exp_title');
                const exportProgressBar = document.getElementById('exportProgressBar'); if (exportProgressBar) exportProgressBar.style.width = '0%';
                const exportStatus = document.getElementById('exportStatus'); if (exportStatus) exportStatus.textContent = t('modal_exp_status');
                const exportResolution = document.getElementById('exportResolution'); const resVal = exportResolution ? exportResolution.value : 'source'; let exportWidth = exportVideo.videoWidth, exportHeight = exportVideo.videoHeight;
                if (resVal !== 'source') [exportWidth, exportHeight] = resVal.split('x').map(Number);
                const exportCanvas = document.createElement('canvas'); exportCanvas.width = exportWidth; exportCanvas.height = exportHeight; const scale = exportWidth / exportVideo.videoWidth;
                try {
                    const frames = [];
                    const fpsInput = document.getElementById('fpsInput'); const fps = fpsInput ? parseInt(fpsInput.value) : 24; const totalFrames = Math.ceil(exportVideo.duration * fps); const timeStep = 1 / fps;
                    for (let i = 0; i < totalFrames; i++) {
                        abortController.signal.throwIfAborted();
                        const targetTime = i * timeStep;
                        if (Math.abs(exportVideo.currentTime - targetTime) > 0.01) {
                            await new Promise(resolve => { let fired = false; const handler = () => { if(fired) return; fired = true; exportVideo.removeEventListener('seeked', handler); resolve(); }; exportVideo.addEventListener('seeked', handler); exportVideo.currentTime = targetTime; setTimeout(() => { if(!fired){ fired = true; exportVideo.removeEventListener('seeked', handler); resolve(); } }, 500); });
                        }
                        abortController.signal.throwIfAborted();
                        if (exportRenderMode === 'glass') { generateGlass(exportCanvas, scale, exportVideo); } else { generateHalftone(exportCanvas, scale, exportVideo, getInterpolatedGridSize(targetTime)); }
                        const blob = await new Promise(res => exportCanvas.toBlob(res, 'image/png'));
                        abortController.signal.throwIfAborted();
                        if (!blob) throw new Error('Frame encoding failed.');
                        frames.push({ name: `frame_${i.toString().padStart(5, '0')}.png`, data: await blob.arrayBuffer() });
                        const pb = document.getElementById('exportProgressBar'); if(pb) pb.style.width = `${((i + 1) / totalFrames) * 100}%`;
                        const st = document.getElementById('exportStatus'); if(st) st.textContent = `${t('msg_engine')} ${i + 1} / ${totalFrames}`;
                    }
                    abortController.signal.throwIfAborted();
                    const et = document.getElementById('exportTitle'); if(et) et.textContent = t('msg_compressing');
                    const content = await packageZipFrames(frames, abortController.signal, (percent) => {
                        const pb = document.getElementById('exportProgressBar'); if(pb) pb.style.width = `${Math.max(percent, ((totalFrames-1)/totalFrames)*100)}%`;
                        const st = document.getElementById('exportStatus'); if(st) st.textContent = `Compressing: ${Math.round(percent)}%`;
                    });
                    abortController.signal.throwIfAborted();
                    const url = URL.createObjectURL(content); const link = document.createElement('a'); link.href = url; link.download = `zyronmatrix_video_export_${Date.now()}.zip`; link.style.display = 'none'; document.body.appendChild(link); link.click(); document.body.removeChild(link); setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                    if (e?.name !== 'AbortError') { console.error(e); showModal({ title: t('msg_err'), message: t('msg_err_export'), hideCancel: true }); }
                } finally {
                    if (exportAbortController === abortController) exportAbortController = null;
                    isExporting = false;
                    setExportControlsLocked(false);
                    if(exportOverlay) exportOverlay.style.display = 'none';
                    if (resumeAfterExport && exportVideo === videoElement && isVideo) exportVideo.play().catch(() => {});
                }
            });
            document.getElementById('cancelExport')?.addEventListener('click', () => { isExporting = false; exportAbortController?.abort(); });

            // --- DRAG AND DROP & FILE UPLOAD ---
            document.getElementById('fileUpload')?.addEventListener('change', (e) => {
                if (!isExporting && !isRasterExporting) handleMediaFile(e.target.files[0]);
                e.target.value = '';
            });

            let dragCounter = 0;
            document.addEventListener('dragenter', (e) => {
                e.preventDefault(); dragCounter++;
                const overlay = document.getElementById('dragOverlay');
                if(overlay) { overlay.classList.remove('hidden'); overlay.classList.add('flex'); }
            });
            document.addEventListener('dragleave', (e) => {
                e.preventDefault(); dragCounter = Math.max(0, dragCounter - 1);
                if (dragCounter === 0) {
                    const overlay = document.getElementById('dragOverlay');
                    if(overlay) { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }
                }
            });
            document.addEventListener('dragover', (e) => { e.preventDefault(); });
            document.addEventListener('drop', (e) => {
                e.preventDefault(); dragCounter = 0;
                const overlay = document.getElementById('dragOverlay');
                if(overlay) { overlay.classList.add('hidden'); overlay.classList.remove('flex'); }
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    if (!isExporting && !isRasterExporting) handleMediaFile(e.dataTransfer.files[0]);
                }
            });

            const playPauseBtn = document.getElementById('playPauseBtn');
            if(playPauseBtn) playPauseBtn.onclick = () => { if (isExporting) return; isManuallyOverridingGrid = false; if (videoElement) { if (videoElement.paused) { videoElement.play().catch(e=>{}); } else { videoElement.pause(); } } };
            function stepFrame(direction) { if (isExporting || !isVideo || !videoElement) return; isManuallyOverridingGrid = false; videoElement.pause(); const fps = document.getElementById('fpsInput') ? parseInt(document.getElementById('fpsInput').value) : 24; videoElement.currentTime = Math.max(0, Math.min(videoElement.duration, videoElement.currentTime + (direction * (1 / (fps || 24))))); const vs = document.getElementById('videoScrubber'); if(vs) vs.value = (videoElement.currentTime / videoElement.duration) * 100 || 0; updateTimeDisplay(); }
            const prevFrameBtn = document.getElementById('prevFrameBtn'); if(prevFrameBtn) prevFrameBtn.onclick = () => stepFrame(-1);
            const nextFrameBtn = document.getElementById('nextFrameBtn'); if(nextFrameBtn) nextFrameBtn.onclick = () => stepFrame(1);
            const videoScrubber = document.getElementById('videoScrubber');
            const startScrubbing = () => { if (isExporting || !isVideo || !videoElement) return; isScrubbing = true; isManuallyOverridingGrid = false; wasPlaying = !videoElement.paused; videoElement.pause(); };
            const stopScrubbing = () => { if (isExporting || !isVideo || !videoElement) return; isScrubbing = false; if (wasPlaying) { videoElement.play().catch(e=>{}); } };
            videoScrubber?.addEventListener('mousedown', startScrubbing); videoScrubber?.addEventListener('touchstart', startScrubbing, {passive: true}); videoScrubber?.addEventListener('mouseup', stopScrubbing); videoScrubber?.addEventListener('touchend', stopScrubbing);
            videoScrubber?.addEventListener('input', (e) => { if (isExporting || !isVideo || !videoElement) return; isManuallyOverridingGrid = false; videoElement.currentTime = (e.target.value / 100) * videoElement.duration; updateTimeDisplay(); });
            document.addEventListener('mouseup', () => { if (isScrubbing) stopScrubbing(); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isCssFullscreen) { const p = document.getElementById('previewContainer'); isCssFullscreen = false; p?.classList.replace('fixed', 'relative'); p?.classList.add('p-4', 'md:p-8', 'h-[50vh]', 'lg:h-[calc(100vh-140px)]'); p?.classList.remove('inset-0', 'z-[100]', 'w-screen', 'h-screen'); document.getElementById('fsEnterIcon')?.classList.remove('hidden'); document.getElementById('fsExitIcon')?.classList.add('hidden'); triggerResize(); return; } if (!isVideo || !videoElement || isExporting || e.target.tagName === 'INPUT') return; if (e.code === 'Space') { e.preventDefault(); playPauseBtn?.click(); } else if (e.code === 'ArrowLeft') { e.preventDefault(); stepFrame(-1); } else if (e.code === 'ArrowRight') { e.preventDefault(); stepFrame(1); } });

            document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
                const p = document.getElementById('previewContainer');
                if (!document.fullscreenElement && !isCssFullscreen) {
                    if (p?.requestFullscreen) p.requestFullscreen().catch(() => { isCssFullscreen = true; p?.classList.replace('relative', 'fixed'); p?.classList.remove('p-4', 'md:p-8', 'h-[50vh]', 'lg:h-[calc(100vh-140px)]'); p?.classList.add('inset-0', 'z-[100]', 'w-screen', 'h-screen'); document.getElementById('fsEnterIcon')?.classList.add('hidden'); document.getElementById('fsExitIcon')?.classList.remove('hidden'); triggerResize(); });
                    else { isCssFullscreen = true; p?.classList.replace('relative', 'fixed'); p?.classList.remove('p-4', 'md:p-8', 'h-[50vh]', 'lg:h-[calc(100vh-140px)]'); p?.classList.add('inset-0', 'z-[100]', 'w-screen', 'h-screen'); document.getElementById('fsEnterIcon')?.classList.add('hidden'); document.getElementById('fsExitIcon')?.classList.remove('hidden'); triggerResize(); }
                } else {
                    if (document.fullscreenElement) document.exitFullscreen();
                    else if (isCssFullscreen) { isCssFullscreen = false; p?.classList.replace('fixed', 'relative'); p?.classList.add('p-4', 'md:p-8', 'h-[50vh]', 'lg:h-[calc(100vh-140px)]'); p?.classList.remove('inset-0', 'z-[100]', 'w-screen', 'h-screen'); document.getElementById('fsEnterIcon')?.classList.remove('hidden'); document.getElementById('fsExitIcon')?.classList.add('hidden'); triggerResize(); }
                }
            });
            document.addEventListener('fullscreenchange', () => {
                const isNativeFullscreen = Boolean(document.fullscreenElement);
                document.getElementById('fsEnterIcon')?.classList.toggle('hidden', isNativeFullscreen);
                document.getElementById('fsExitIcon')?.classList.toggle('hidden', !isNativeFullscreen);
                triggerResize();
            });

            document.getElementById('addKeyframe')?.addEventListener('click', () => {
                if (isExporting) return;
                if (!isVideo || !videoElement) { showModal({ title: t('msg_sys_notice'), message: t('msg_err_keyframe'), hideCancel: true }); return; }
                const time = videoElement.currentTime; const gs = document.getElementById('gridSize'); const value = parseFloat(gs?.value || 20);
                keyframes = keyframes.filter(k => Math.abs(k.time - time) > 0.1); keyframes.push({ time, value });
                isManuallyOverridingGrid = false; updateKeyframeUI(); processFrame();
                const btn = document.getElementById('addKeyframe'); const oldText = btn.innerHTML; btn.innerHTML = t('msg_key_added'); setTimeout(() => { btn.innerHTML = oldText; }, 1500);
            });
            document.getElementById('clearKeyframes')?.addEventListener('click', () => { if (isExporting) return; keyframes = []; updateKeyframeUI(); if (!isVideo || (videoElement && videoElement.paused)) processFrame(); });

            document.getElementById('resetGeometryBtn')?.addEventListener('click', () => {
                const ids = ['gridSize', 'dotScale', 'dotCutoff', 'ditherThreshold', 'stuckiFactor', 'glassImgScale', 'glassImgOffsetX', 'glassImgOffsetY', 'glassExtract', 'glassMaskW', 'glassMaskH', 'glassMaskX', 'glassMaskY'];
                ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = defaults[id]; });

                const bools = ['fixedDotSize', 'invertMapping', 'ditherSquarePixels'];
                bools.forEach(id => { const el = document.getElementById(id); if(el) el.checked = defaults[id] ?? false; });

                const dm = document.getElementById('ditherMethodSelect'); if (dm) { dm.value = defaults.ditherMethod; dm.dispatchEvent(new Event('change')); }
                isManuallyOverridingGrid = false; const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); updateUIValues(); if (!isVideo || (videoElement && videoElement.paused)) processFrame();
            });

            document.getElementById('resetColorBtn')?.addEventListener('click', () => {
                const resetValues = {
                    bgColor: defaults.bgColor, dotColor: defaults.dotColor, dotStyleSelect: defaults.dotStyle, asciiLogicSelect: defaults.asciiLogic,
                    customColorDark: defaults.customColorDark, customColorMid: defaults.customColorMid, customColorLight: defaults.customColorLight,
                    asciiCharsInput: defaults.asciiChars, asciiPresetSelect: defaults.asciiChars, asciiRatio: defaults.asciiRatio, asciiIntensity: defaults.asciiIntensity,
                    glassLight: defaults.glassLight, glassColorMode: defaults.glassColorMode, glassSpatial1: defaults.glassSpatial1,
                    glassSpatial2: defaults.glassSpatial2, glassAngle: defaults.glassAngle, glassOffset: defaults.glassOffset,
                    glassLut1: defaults.glassLut1, glassLut2: defaults.glassLut2, glassLut3: defaults.glassLut3, glassLut4: defaults.glassLut4, glassLut5: defaults.glassLut5
                };
                Object.entries(resetValues).forEach(([id, value]) => { const el = document.getElementById(id); if(el) el.value = value; });
                const ars = document.getElementById('asciiRemoveSpaces'); if(ars) ars.checked = defaults.asciiRemoveSpaces;
                updateDotStyleUI(); updateGlassColorModeUI(); const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); updateUIValues(); if (!isVideo || (videoElement && videoElement.paused)) processFrame();
            });

            document.getElementById('resetSignalBtn')?.addEventListener('click', () => {
                const ids = ['sourceBrightness', 'sourceContrast', 'brightness', 'contrast', 'glassBlur', 'glassSharp', 'glassStripe', 'glassDisp', 'glassShading', 'glassNoise'];
                ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = defaults[id]; });
                const ss = document.getElementById('smoothStep'); if(ss) ss.checked = defaults.smoothStep;
                const ps = document.getElementById('presetSelect'); if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden'); updateUIValues(); if (!isVideo || (videoElement && videoElement.paused)) processFrame();
            });

            document.getElementById('resetOutputBtn')?.addEventListener('click', () => {
                const er = document.getElementById('exportResolution'); if(er) er.value = 'source';
                const fi = document.getElementById('fpsInput'); if(fi) fi.value = defaults.fps;
                const ps = document.getElementById('presetSelect'); if(ps) ps.value = "";
                document.getElementById('deletePresetBtn')?.classList.add('hidden');
                updateUIValues();
            });
            document.getElementById('resetButton')?.addEventListener('click', () => {
                keyframes = [];
                isManuallyOverridingGrid = false;
                updateKeyframeUI();
                document.getElementById('resetGeometryBtn')?.click();
                document.getElementById('resetColorBtn')?.click();
                document.getElementById('resetSignalBtn')?.click();
                document.getElementById('resetOutputBtn')?.click();
                setRenderMode(defaults.renderMode);
                processFrame();
            });

            document.getElementById('savePresetBtn')?.addEventListener('click', async () => {
                if (isExporting || isRasterExporting) return;
                const operationGeneration = authGeneration;
                const operationUid = currentUser?.uid ?? null;
                const operationServices = firebaseServices;
                const operationIsCloud = Boolean(operationServices && isProUser && operationUid);
                const name = await showModal({ title: t('msg_save_preset'), message: t('msg_enter_name'), showInput: true }); if (!name) return;
                if (operationGeneration !== authGeneration || operationUid !== (currentUser?.uid ?? null)) { await showModal({ title: t('msg_err'), message: t('msg_auth_changed'), hideCancel: true }); return; }
                if (name.length > 80 || name.includes('/')) { await showModal({ title: t('msg_err'), message: t('msg_preset_name_invalid'), hideCancel: true }); return; }
                const p = {};
                const ids = ['gridSize', 'dotScale', 'sourceBrightness', 'sourceContrast', 'brightness', 'contrast', 'fpsInput', 'dotCutoff', 'ditherThreshold', 'stuckiFactor', 'asciiRatio', 'asciiIntensity', 'glassImgScale', 'glassImgOffsetX', 'glassImgOffsetY', 'glassMaskW', 'glassMaskH', 'glassMaskX', 'glassMaskY', 'glassLight', 'glassAngle', 'glassOffset', 'glassBlur', 'glassSharp', 'glassStripe', 'glassDisp', 'glassShading', 'glassNoise'];
                ids.forEach(id => { const el = document.getElementById(id); if(el) p[id] = parseFloat(el.value); });
                const strs = ['bgColor', 'dotColor', 'ditherMethodSelect', 'asciiLogicSelect', 'dotStyleSelect', 'customColorDark', 'customColorMid', 'customColorLight', 'asciiCharsInput', 'glassExtract', 'glassColorMode', 'glassSpatial1', 'glassSpatial2', 'glassLut1', 'glassLut2', 'glassLut3', 'glassLut4', 'glassLut5'];
                strs.forEach(id => { const el = document.getElementById(id); if(el) p[id.replace('Select', '')] = el.value; });
                const bools = ['invertMapping', 'smoothStep', 'fixedDotSize', 'asciiRemoveSpaces', 'ditherSquarePixels'];
                bools.forEach(id => { const el = document.getElementById(id); if(el) p[id] = el.checked; });
                p.renderMode = currentRenderMode;
                userPresets[name] = p; const ps = document.getElementById('presetSelect'); updatePresetDropdown(); if(ps) ps.value = name; document.getElementById('deletePresetBtn')?.classList.remove('hidden');
                persistLocalPresets(operationUid);
                if (operationIsCloud) {
                    try {
                        const { db, firestoreApi } = operationServices;
                        await firestoreApi.setDoc(firestoreApi.doc(db, 'artifacts', currentAppId, 'users', operationUid, 'presets', name), p);
                        if (operationGeneration === authGeneration) setCloudStatus('status_synced');
                    } catch (e) {
                        if (operationGeneration === authGeneration) setCloudStatus('status_sync_err');
                        await showModal({ title: t('msg_err'), message: t('msg_err_cloud'), hideCancel: true });
                    }
                }
            });

            document.getElementById('deletePresetBtn')?.addEventListener('click', async () => {
                if (isExporting || isRasterExporting) return;
                const ps = document.getElementById('presetSelect'); const name = ps ? ps.value : null; if (!name) return;
                const operationGeneration = authGeneration;
                const operationUid = currentUser?.uid ?? null;
                const operationServices = firebaseServices;
                const operationIsCloud = Boolean(operationServices && isProUser && operationUid);
                if (await showModal({ title: t('msg_del_preset'), message: `${t('msg_confirm_del')} "${name}" ?`, showInput: false })) {
                    if (operationGeneration !== authGeneration || operationUid !== (currentUser?.uid ?? null)) { await showModal({ title: t('msg_err'), message: t('msg_auth_changed'), hideCancel: true }); return; }
                    delete userPresets[name]; if(ps) ps.value = ""; document.getElementById('deletePresetBtn')?.classList.add('hidden');
                    persistLocalPresets(operationUid);
                    updatePresetDropdown();
                    if (operationIsCloud) {
                        try {
                            const { db, firestoreApi } = operationServices;
                            await firestoreApi.deleteDoc(firestoreApi.doc(db, 'artifacts', currentAppId, 'users', operationUid, 'presets', name));
                        } catch (e) {
                            if (operationGeneration === authGeneration) setCloudStatus('status_sync_err');
                            await showModal({ title: t('msg_err'), message: t('msg_delete_cloud'), hideCancel: true });
                        }
                    }
                }
            });
        }

        // --- BOOTSTRAP ---
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initApp);
        } else {
            initApp();
        }
