//! Aether for Windows. Opens on the Wallhaven tab, same layout as the studio:
//! search, Top List, pink Search, category and purity chips, a resolution
//! floor, and a masonry of wallpapers with resolution and file size.

#![cfg_attr(windows, windows_subsystem = "windows")]

mod apply;

use std::collections::HashMap;
use std::io::Read;
use std::sync::mpsc::{self, Receiver, Sender};

use egui::{Color32, RichText, TextureHandle, Vec2};

const ACCENT: Color32 = Color32::from_rgb(137, 180, 250);
const TABS: [&str; 7] = ["Editor", "Wallhaven", "GitHub", "Local", "Favorites", "Blueprints", "Omarchy"];
const SORTS: [(&str, &str); 6] = [
    ("toplist", "Top List"),
    ("date_added", "Latest"),
    ("relevance", "Relevance"),
    ("random", "Random"),
    ("views", "Views"),
    ("favorites", "Most Favorited"),
];
const RESOLUTIONS: [(&str, &str); 4] = [
    ("1920x1080", "1920×1080+"),
    ("2560x1440", "2560×1440+"),
    ("3840x2160", "3840×2160+"),
    ("", "Any"),
];

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280.0, 820.0])
            .with_title("Aether"),
        ..Default::default()
    };
    eframe::run_native(
        "Aether",
        options,
        Box::new(|cc| {
            style_aether(&cc.egui_ctx);
            Ok(Box::new(Aether::new()))
        }),
    )
}

fn style_aether(ctx: &egui::Context) {
    let mut visuals = egui::Visuals::dark();
    let ink = Color32::from_rgb(18, 18, 22);
    visuals.panel_fill = ink;
    visuals.window_fill = ink;
    visuals.extreme_bg_color = Color32::from_rgb(12, 12, 16);
    visuals.faint_bg_color = Color32::from_rgb(32, 32, 38);
    visuals.widgets.inactive.bg_fill = Color32::from_rgb(36, 36, 42);
    visuals.widgets.hovered.bg_fill = Color32::from_rgb(52, 36, 46);
    visuals.widgets.active.bg_fill = ACCENT;
    visuals.selection.bg_fill = ACCENT;
    visuals.hyperlink_color = ACCENT;
    visuals.widgets.noninteractive.rounding = egui::Rounding::ZERO;
    visuals.widgets.inactive.rounding = egui::Rounding::ZERO;
    visuals.widgets.hovered.rounding = egui::Rounding::ZERO;
    visuals.widgets.active.rounding = egui::Rounding::ZERO;
    ctx.set_visuals(visuals);
}

struct Wallpaper {
    id: String,
    resolution: String,
    file_size: u64,
    thumb: String,
    full: String,
    ratio: f32,
}

struct SearchDone {
    generation: u64,
    total: u32,
    page: u32,
    pages: u32,
    items: Vec<Wallpaper>,
    error: Option<String>,
}

struct ThumbDone {
    id: String,
    bytes: Vec<u8>,
}

struct ApplyDone {
    text: String,
}

struct Aether {
    tab: usize,
    query: String,
    sorting: usize,
    atleast: usize,
    general: bool,
    anime: bool,
    people: bool,
    sfw: bool,
    sketchy: bool,
    nsfw: bool,
    api_key: String,
    show_key: bool,
    page: u32,
    pages: u32,
    total: u32,
    items: Vec<Wallpaper>,
    error: String,
    status: String,
    loading: bool,
    generation: u64,
    search_rx: Receiver<SearchDone>,
    search_tx: Sender<SearchDone>,
    thumb_rx: Receiver<ThumbDone>,
    thumb_tx: Sender<ThumbDone>,
    apply_rx: Receiver<ApplyDone>,
    apply_tx: Sender<ApplyDone>,
    textures: HashMap<String, TextureHandle>,
    queued: HashMap<String, bool>,
    favorites: Vec<Wallpaper>,
    applying: bool,
}

impl Aether {
    fn new() -> Self {
        let (search_tx, search_rx) = mpsc::channel();
        let (thumb_tx, thumb_rx) = mpsc::channel();
        let (apply_tx, apply_rx) = mpsc::channel();
        let mut app = Self {
            tab: 1,
            query: String::new(),
            sorting: 0,
            atleast: 0,
            general: true,
            anime: true,
            people: true,
            sfw: true,
            sketchy: false,
            nsfw: false,
            api_key: String::new(),
            show_key: false,
            page: 1,
            pages: 1,
            total: 0,
            items: Vec::new(),
            error: String::new(),
            status: String::new(),
            loading: false,
            generation: 0,
            search_rx,
            search_tx,
            thumb_rx,
            thumb_tx,
            apply_rx,
            apply_tx,
            textures: HashMap::new(),
            queued: HashMap::new(),
            favorites: Vec::new(),
            applying: false,
        };
        app.search();
        app
    }

    fn search(&mut self) {
        self.generation += 1;
        self.loading = true;
        self.error.clear();
        let generation = self.generation;
        let url = self.search_url();
        let tx = self.search_tx.clone();
        std::thread::spawn(move || {
            let done = fetch_search(generation, &url);
            let _ = tx.send(done);
        });
    }

    fn search_url(&self) -> String {
        let categories = bits(self.general, self.anime, self.people);
        let purity = bits(self.sfw, self.sketchy, self.nsfw);
        let mut url = format!(
            "https://wallhaven.cc/api/v1/search?categories={categories}&purity={purity}&sorting={}&order=desc&page={}",
            SORTS[self.sorting].0,
            self.page.max(1)
        );
        if SORTS[self.sorting].0 == "toplist" {
            url.push_str("&topRange=1M");
        }
        if !RESOLUTIONS[self.atleast].0.is_empty() {
            url.push_str("&atleast=");
            url.push_str(RESOLUTIONS[self.atleast].0);
        }
        if !self.query.trim().is_empty() {
            url.push_str("&q=");
            url.push_str(&encode(self.query.trim()));
        }
        if !self.api_key.trim().is_empty() {
            url.push_str("&apikey=");
            url.push_str(&encode(self.api_key.trim()));
        }
        url
    }

    fn apply_wallpaper(&mut self, item: &Wallpaper) {
        if self.applying {
            return;
        }
        self.applying = true;
        self.status = format!("Downloading {}…", item.id);
        let full = item.full.clone();
        let tx = self.apply_tx.clone();
        std::thread::spawn(move || {
            let text = match download(&full, 28_000_000) {
                Ok(bytes) => {
                    let ext = ext_of(&full);
                    let accent = dominant(&bytes);
                    match apply::install_wallpaper(&bytes, ext) {
                        Ok(line) => match accent.and_then(|rgb| apply::install_accent(rgb).ok()) {
                            Some(color) => format!("{line}\n{color}"),
                            None => line,
                        },
                        Err(error) => error,
                    }
                }
                Err(error) => error,
            };
            let _ = tx.send(ApplyDone { text });
        });
    }
}

impl eframe::App for Aether {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        while let Ok(done) = self.search_rx.try_recv() {
            if done.generation == self.generation {
                self.loading = false;
                self.total = done.total;
                self.page = done.page;
                self.pages = done.pages;
                self.items = done.items;
                self.error = done.error.unwrap_or_default();
            }
        }
        while let Ok(thumb) = self.thumb_rx.try_recv() {
            if let Some(image) = decode_image(&thumb.bytes) {
                let handle = ctx.load_texture(&thumb.id, image, egui::TextureOptions::LINEAR);
                self.textures.insert(thumb.id, handle);
            }
        }
        if let Ok(done) = self.apply_rx.try_recv() {
            self.applying = false;
            self.status = done.text;
        }
        if self.loading || self.applying || self.textures.len() < self.items.len() {
            ctx.request_repaint();
        }

        egui::TopBottomPanel::top("bar").exact_height(48.0).show(ctx, |ui| {
            ui.horizontal_centered(|ui| {
                ui.add_space(8.0);
                ui.label(RichText::new("AETHER").strong().size(14.0));
                ui.add_space(12.0);
                for (index, label) in TABS.iter().enumerate() {
                    let selected = self.tab == index;
                    let text = if selected {
                        RichText::new(*label).color(ACCENT).strong()
                    } else {
                        RichText::new(*label).color(Color32::from_rgb(180, 180, 188))
                    };
                    if ui.selectable_label(selected, text).clicked() {
                        self.tab = index;
                    }
                }
            });
        });

        egui::CentralPanel::default().show(ctx, |ui| match self.tab {
            1 | 4 => self.wallhaven(ui, ctx),
            0 => self.note(ui, "Editor", "Pick a wallpaper on Wallhaven. Aether sets it as the desktop and writes the accent into your Windows account."),
            2 => self.note(ui, "GitHub", "The Windows script, Terminal scheme, and VS Code colors are exported from the browser studio. This window sets the wallpaper and accent directly."),
            3 => self.note(ui, "Local", "Local files stay in the browser studio. Here, click any Wallhaven wallpaper to set it."),
            5 => self.note(ui, "Blueprints", "Saved blueprints stay in this browser profile of the studio. The Windows app applies the wallpaper you click."),
            _ => self.note(ui, "Omarchy", "Shared wallpapers come from Wallhaven. Omarchy is a tab in the same bar, not the wallpaper source."),
        });
    }
}

impl Aether {
    fn note(&self, ui: &mut egui::Ui, title: &str, body: &str) {
        ui.add_space(24.0);
        ui.heading(title);
        ui.add_space(8.0);
        ui.label(body);
        if !self.status.is_empty() {
            ui.add_space(12.0);
            ui.label(RichText::new(&self.status).color(Color32::from_rgb(190, 190, 198)));
        }
    }

    fn wallhaven(&mut self, ui: &mut egui::Ui, ctx: &egui::Context) {
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            let field = ui.add(
                egui::TextEdit::singleline(&mut self.query)
                    .hint_text("Search wallpapers…")
                    .desired_width(ui.available_width() - 280.0),
            );
            if field.lost_focus() && ui.input(|input| input.key_pressed(egui::Key::Enter)) {
                self.page = 1;
                self.search();
            }
            egui::ComboBox::from_id_salt("sort")
                .selected_text(SORTS[self.sorting].1)
                .width(140.0)
                .show_ui(ui, |ui| {
                    for (index, (_, label)) in SORTS.iter().enumerate() {
                        if ui.selectable_label(self.sorting == index, *label).clicked() {
                            self.sorting = index;
                            self.page = 1;
                            self.search();
                        }
                    }
                });
            let search = egui::Button::new(RichText::new("Search").color(Color32::from_rgb(17, 17, 22)).strong()).fill(ACCENT);
            if ui.add(search).clicked() {
                self.page = 1;
                self.search();
            }
        });
        ui.add_space(6.0);
        let mut filters_changed = false;
        ui.horizontal(|ui| {
            filters_changed |= chip(ui, "General", &mut self.general, ACCENT);
            filters_changed |= chip(ui, "Anime", &mut self.anime, ACCENT);
            filters_changed |= chip(ui, "People", &mut self.people, ACCENT);
            ui.separator();
            filters_changed |= chip(ui, "SFW", &mut self.sfw, Color32::from_rgb(166, 227, 161));
            filters_changed |= chip(ui, "Sketchy", &mut self.sketchy, Color32::from_rgb(249, 226, 175));
            filters_changed |= chip(ui, "NSFW", &mut self.nsfw, Color32::from_rgb(243, 139, 168));
            ui.separator();
            let before = self.atleast;
            egui::ComboBox::from_id_salt("res")
                .selected_text(RESOLUTIONS[self.atleast].1)
                .width(130.0)
                .show_ui(ui, |ui| {
                    for (index, (_, label)) in RESOLUTIONS.iter().enumerate() {
                        ui.selectable_value(&mut self.atleast, index, *label);
                    }
                });
            filters_changed |= self.atleast != before;
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                let count = if self.tab == 4 {
                    format!("{} favorites", self.favorites.len())
                } else if self.loading {
                    "Searching…".to_string()
                } else {
                    format!("{} results", self.total)
                };
                ui.label(RichText::new(count).color(Color32::from_rgb(160, 160, 168)));
            });
        });
        if filters_changed {
            self.page = 1;
            self.search();
        }
        if self.nsfw && self.api_key.trim().is_empty() {
            ui.label(
                RichText::new("NSFW on Wallhaven needs an API key.")
                    .size(12.0)
                    .color(Color32::from_rgb(160, 160, 168)),
            );
        }
        ui.horizontal(|ui| {
            if ui.small_button(if self.show_key { "Hide API key" } else { "API key" }).clicked() {
                self.show_key = !self.show_key;
            }
            if self.show_key {
                ui.add(egui::TextEdit::singleline(&mut self.api_key).password(true).desired_width(280.0).hint_text("optional"));
            }
            if !self.status.is_empty() {
                ui.label(RichText::new(&self.status).size(12.0).color(Color32::from_rgb(190, 190, 198)));
            }
        });
        if !self.error.is_empty() {
            ui.colored_label(Color32::from_rgb(255, 120, 120), &self.error);
        }

        let favorites = self.tab == 4;
        let mut clicked: Option<usize> = None;
        let mut heart: Option<usize> = None;
        egui::ScrollArea::vertical().show(ui, |ui| {
            let available = ui.available_width();
            let card_w = 240.0;
            let columns = ((available / (card_w + 8.0)).floor() as usize).max(1);
            let source_len = if favorites { self.favorites.len() } else { self.items.len() };
            let mut index = 0;
            while index < source_len {
                ui.horizontal(|ui| {
                    for column in 0..columns {
                        let item_index = index + column;
                        if item_index >= source_len {
                            break;
                        }
                        let (id, thumb_url, ratio, resolution, file_size) = {
                            let item = if favorites { &self.favorites[item_index] } else { &self.items[item_index] };
                            (item.id.clone(), item.thumb.clone(), item.ratio, item.resolution.clone(), item.file_size)
                        };
                        self.ensure_thumb(&id, &thumb_url);
                        ui.allocate_ui(Vec2::new(card_w, card_w / ratio.max(0.4)), |ui| {
                            let frame = egui::Frame::none()
                                .fill(Color32::from_rgb(28, 28, 32))
                                .rounding(0.0)
                                .show(ui, |ui| {
                                    let height = (card_w / ratio.max(0.4)).clamp(90.0, 360.0);
                                    if let Some(texture) = self.textures.get(&id) {
                                        ui.image((texture.id(), Vec2::new(card_w - 4.0, height)));
                                    } else {
                                        ui.add_sized(Vec2::new(card_w - 4.0, height), egui::Label::new(""));
                                    }
                                    ui.horizontal(|ui| {
                                        ui.label(RichText::new(&resolution).size(11.0).color(Color32::WHITE));
                                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                            ui.label(RichText::new(format_bytes(file_size)).size(11.0).color(Color32::WHITE));
                                        });
                                    });
                                });
                            if frame.response.clicked() {
                                clicked = Some(item_index);
                            }
                            if frame.response.secondary_clicked() {
                                heart = Some(item_index);
                            }
                        });
                    }
                });
                index += columns;
            }
        });
        if let Some(index) = clicked {
            let item = if favorites { self.favorites[index].clone_meta() } else { self.items[index].clone_meta() };
            self.apply_wallpaper(&item);
        }
        if let Some(index) = heart {
            let item = if favorites { self.favorites[index].clone_meta() } else { self.items[index].clone_meta() };
            if let Some(pos) = self.favorites.iter().position(|saved| saved.id == item.id) {
                self.favorites.remove(pos);
            } else {
                self.favorites.push(item);
            }
        }
        if !favorites && self.pages > 1 {
            ui.horizontal(|ui| {
                ui.label(format!("Page {} of {}", self.page, self.pages));
                if ui.add_enabled(self.page > 1, egui::Button::new("Back")).clicked() {
                    self.page -= 1;
                    self.search();
                }
                if ui.add_enabled(self.page < self.pages, egui::Button::new("Next")).clicked() {
                    self.page += 1;
                    self.search();
                }
            });
        }
        let _ = ctx;
    }

    fn ensure_thumb(&mut self, id: &str, url: &str) {
        if self.textures.contains_key(id) || self.queued.contains_key(id) {
            return;
        }
        self.queued.insert(id.to_string(), true);
        let id = id.to_string();
        let url = url.to_string();
        let tx = self.thumb_tx.clone();
        std::thread::spawn(move || {
            if let Ok(bytes) = download(&url, 4_000_000) {
                let _ = tx.send(ThumbDone { id, bytes });
            }
        });
    }
}

impl Wallpaper {
    fn clone_meta(&self) -> Wallpaper {
        Wallpaper {
            id: self.id.clone(),
            resolution: self.resolution.clone(),
            file_size: self.file_size,
            thumb: self.thumb.clone(),
            full: self.full.clone(),
            ratio: self.ratio,
        }
    }
}

fn chip(ui: &mut egui::Ui, label: &str, on: &mut bool, on_color: Color32) -> bool {
    let text = if *on {
        RichText::new(label).color(Color32::from_rgb(17, 17, 22)).strong()
    } else {
        RichText::new(label).color(Color32::from_rgb(170, 170, 178))
    };
    let button = egui::Button::new(text)
        .fill(if *on { on_color } else { Color32::from_rgb(22, 22, 27) })
        .rounding(0.0);
    if ui.add(button).clicked() {
        *on = !*on;
        true
    } else {
        false
    }
}

fn bits(a: bool, b: bool, c: bool) -> String {
    let mut value = format!("{}{}{}", u8::from(a), u8::from(b), u8::from(c));
    if value == "000" {
        value = "100".into();
    }
    value
}

fn encode(value: &str) -> String {
    let mut out = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(byte as char),
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn fetch_search(generation: u64, url: &str) -> SearchDone {
    match client().get(url).call() {
        Ok(response) => match response.into_json::<serde_json::Value>() {
            Ok(json) => parse_search(generation, json),
            Err(error) => empty_search(generation, Some(redact(&error.to_string()))),
        },
        Err(error) => empty_search(generation, Some(redact(&error.to_string()))),
    }
}

fn client() -> ureq::Agent {
    ureq::AgentBuilder::new().user_agent("Aether/1.0 (Windows)").build()
}

fn redact(text: &str) -> String {
    let mut result = text.to_string();
    let key = "apikey=";
    while let Some(start) = result.find(key) {
        let value_start = start + key.len();
        let value_end = result[value_start..]
            .find(['&', ' ', '"', '\n'])
            .map(|index| value_start + index)
            .unwrap_or(result.len());
        result.replace_range(value_start..value_end, "***");
    }
    result
}

fn parse_search(generation: u64, json: serde_json::Value) -> SearchDone {
    let meta = &json["meta"];
    let mut items = Vec::new();
    if let Some(rows) = json["data"].as_array() {
        for row in rows {
            let id = row["id"].as_str().unwrap_or("").to_string();
            if id.is_empty() {
                continue;
            }
            let resolution = row["resolution"].as_str().unwrap_or("").to_string();
            let thumb = row["thumbs"]["small"].as_str().unwrap_or("").to_string();
            let full = row["path"].as_str().unwrap_or("").to_string();
            if thumb.is_empty() || full.is_empty() {
                continue;
            }
            items.push(Wallpaper {
                id,
                ratio: ratio_of(&resolution),
                resolution,
                file_size: row["file_size"].as_u64().unwrap_or(0),
                thumb,
                full,
            });
        }
    }
    SearchDone {
        generation,
        total: meta["total"].as_u64().unwrap_or(0) as u32,
        page: meta["current_page"].as_u64().unwrap_or(1) as u32,
        pages: meta["last_page"].as_u64().unwrap_or(1) as u32,
        items,
        error: None,
    }
}

fn empty_search(generation: u64, error: Option<String>) -> SearchDone {
    SearchDone {
        generation,
        total: 0,
        page: 1,
        pages: 1,
        items: Vec::new(),
        error,
    }
}

fn download(url: &str, cap: u64) -> Result<Vec<u8>, String> {
    if !url.starts_with("https://w.wallhaven.cc/") && !url.starts_with("https://th.wallhaven.cc/") {
        return Err("Wallpaper host is not Wallhaven.".into());
    }
    let response = client().get(url).call().map_err(|error| redact(&error.to_string()))?;
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(cap)
        .read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    Ok(bytes)
}

fn decode_image(bytes: &[u8]) -> Option<egui::ColorImage> {
    let image = image::load_from_memory(bytes).ok()?;
    let rgba = image.to_rgba8();
    let size = [rgba.width() as usize, rgba.height() as usize];
    Some(egui::ColorImage::from_rgba_unmultiplied(size, rgba.as_raw()))
}

fn ratio_of(resolution: &str) -> f32 {
    let mut parts = resolution.split('x');
    let width: f32 = parts.next().and_then(|value| value.parse().ok()).unwrap_or(16.0);
    let height: f32 = parts.next().and_then(|value| value.parse().ok()).unwrap_or(9.0);
    if height <= 1.0 { 1.6 } else { width / height }
}

fn ext_of(url: &str) -> &'static str {
    let path = url.split('?').next().unwrap_or(url);
    if path.ends_with(".png") {
        "png"
    } else if path.ends_with(".webp") {
        "webp"
    } else {
        "jpg"
    }
}

fn format_bytes(size: u64) -> String {
    if size >= 1_048_576 {
        format!("{:.1} MB", size as f64 / 1_048_576.0)
    } else if size >= 1024 {
        format!("{} KB", size / 1024)
    } else {
        format!("{size} B")
    }
}

fn dominant(bytes: &[u8]) -> Option<[u8; 3]> {
    let image = image::load_from_memory(bytes).ok()?.thumbnail(24, 24).to_rgb8();
    let mut best = None;
    let mut score = 0.0f32;
    for pixel in image.pixels() {
        let [r, g, b] = pixel.0;
        let max = r.max(g).max(b) as f32;
        let min = r.min(g).min(b) as f32;
        let saturation = if max == 0.0 { 0.0 } else { (max - min) / max };
        let value = saturation * max;
        if value > score && max > 40.0 && max < 245.0 {
            score = value;
            best = Some([r, g, b]);
        }
    }
    best
}
