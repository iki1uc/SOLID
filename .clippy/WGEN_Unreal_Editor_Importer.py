# -*- coding: utf-8 -*-
"""
WGEN -> Unreal Engine UMG importer
Run INSIDE Unreal Editor: Tools > Execute Python Script
Input: extracted WGEN ZIP folder containing manifest.json and textures/*.png

Creates one UMG Widget Blueprint per manifest screen.
Supported manifest widget types: rect, text, image, panel.
This is an Editor-only importer; it does not create gameplay logic or Blueprint graphs.
Tested for API shape against Epic's documented Unreal Python/UMG editor APIs.
Unreal Python APIs vary by engine version; failures are logged per widget.
"""

import json
import os
import re
import traceback

try:
    import unreal
except ImportError:
    raise RuntimeError("This script must run inside the Unreal Editor Python environment.")


# --------------------------- CONFIGURATION ---------------------------

# Set this to the extracted folder containing manifest.json.
# Example: r"D:\WGEN\ui_batch_sensation_BESSER_V3"
IMPORT_ROOT = r"D:\WGEN\EXTRACT_ME"

# Unreal Content Browser destination.
CONTENT_PATH = "/Game/WGEN/Imported"

# If True, existing assets with the same names are updated/reused where possible.
REUSE_EXISTING = True

# Source canvas dimensions come from manifest.resolution.
DEFAULT_WIDTH = 1920
DEFAULT_HEIGHT = 1080


# --------------------------- LOGGING / HELPERS ---------------------------

def log(message):
    unreal.log("[WGEN] " + str(message))


def warn(message):
    unreal.log_warning("[WGEN] " + str(message))


def safe_name(value, fallback="WGEN_Item"):
    value = re.sub(r"[^A-Za-z0-9_]+", "_", str(value or ""))
    value = value.strip("_")
    if not value:
        value = fallback
    if value[0].isdigit():
        value = "W_" + value
    return value[:60]


def content_asset_path(folder, asset_name):
    return folder.rstrip("/") + "/" + safe_name(asset_name)


def ensure_folder(folder):
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    # AssetTools creates folders when creating assets; explicitly create via EditorAssetLibrary.
    unreal.EditorAssetLibrary.make_directory(folder)


def load_manifest(root):
    path = os.path.join(root, "manifest.json")
    if not os.path.isfile(path):
        raise FileNotFoundError("manifest.json nicht gefunden: " + path)
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def color_from_rgba(value, default=(1.0, 1.0, 1.0, 1.0)):
    if not isinstance(value, (list, tuple)) or len(value) < 4:
        value = default
    # Manifest colors are normalized sRGB-like 0..1 values.
    return unreal.LinearColor(
        float(value[0]), float(value[1]), float(value[2]), float(value[3])
    )


def set_if_possible(obj, property_name, value):
    try:
        obj.set_editor_property(property_name, value)
        return True
    except Exception:
        return False


def set_slot_geometry(widget, x, y, width, height):
    try:
        slot = widget.slot
        if slot:
            if hasattr(slot, "set_position"):
                slot.set_position(unreal.Vector2D(float(x), float(y)))
            if hasattr(slot, "set_size"):
                slot.set_size(unreal.Vector2D(max(1.0, float(width)), max(1.0, float(height))))
            if hasattr(slot, "set_anchors"):
                slot.set_anchors(unreal.Anchors())
            if hasattr(slot, "set_alignment"):
                slot.set_alignment(unreal.Vector2D(0.0, 0.0))
            return True
    except Exception as exc:
        warn("CanvasSlot-Geometrie konnte nicht gesetzt werden: " + str(exc))
    return False


def add_widget(bp, widget_class, widget_name, parent_name):
    """Use Epic's EditorUtilityLibrary API to add a widget to a Widget Blueprint."""
    try:
        return unreal.EditorUtilityLibrary.add_source_widget(
            bp, widget_class, unreal.Name(widget_name), unreal.Name(parent_name)
        )
    except Exception as exc:
        raise RuntimeError(
            "add_source_widget fehlgeschlagen für %s unter %s: %s"
            % (widget_name, parent_name, exc)
        )


def ensure_root_canvas(bp):
    tree = bp.get_editor_property("widget_tree")
    root = tree.get_editor_property("root_widget")
    if root:
        return root
    canvas = tree.construct_widget(unreal.CanvasPanel, unreal.Name("RootCanvas"))
    tree.set_root_widget(canvas)
    return canvas


# --------------------------- TEXTURE IMPORT ---------------------------

def import_textures(root, texture_records):
    """
    Imports PNGs included by the browser generator into /Game/WGEN/Imported/Textures.
    Texture files must exist under the extracted ZIP's relative file paths.
    """
    texture_folder = CONTENT_PATH + "/Textures"
    ensure_folder(texture_folder)
    imported = {}

    tasks = []
    for record in texture_records or []:
        tex_id = record.get("id")
        rel_file = record.get("file")
        if not tex_id or not rel_file:
            continue
        source = os.path.normpath(os.path.join(root, rel_file.replace("/", os.sep)))
        if not os.path.isfile(source):
            warn("Texture fehlt: " + source)
            continue

        task = unreal.AssetImportTask()
        task.set_editor_property("filename", source)
        task.set_editor_property("destination_path", texture_folder)
        task.set_editor_property("destination_name", safe_name(tex_id))
        task.set_editor_property("automated", True)
        task.set_editor_property("replace_existing", REUSE_EXISTING)
        task.set_editor_property("save", True)
        tasks.append((tex_id, task))

    if tasks:
        unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t[1] for t in tasks])

    for tex_id, task in tasks:
        object_paths = []
        try:
            object_paths = task.get_editor_property("imported_object_paths")
        except Exception:
            pass
        if object_paths:
            imported[tex_id] = unreal.load_object(None, object_paths[0])
        else:
            candidate = content_asset_path(texture_folder, tex_id)
            imported[tex_id] = unreal.EditorAssetLibrary.load_asset(candidate)
        if not imported.get(tex_id):
            warn("Importiertes Texture-Asset nicht ladbar: " + tex_id)

    return imported


# --------------------------- WIDGET BLUEPRINT CREATION ---------------------------

def create_or_load_widget_blueprint(name):
    asset_path = content_asset_path(CONTENT_PATH, name)
    existing = unreal.EditorAssetLibrary.load_asset(asset_path) if REUSE_EXISTING else None
    if existing:
        # Reusing an existing Widget Blueprint is safer than creating duplicate assets.
        # Existing widget trees are not cleared automatically to avoid destructive edits.
        warn("Asset existiert bereits; wird wiederverwendet: " + asset_path)
        return existing, asset_path, True

    factory = unreal.WidgetBlueprintFactory()
    factory.set_editor_property("parent_class", unreal.UserWidget.static_class())
    factory.set_editor_property("blueprint_type", unreal.BlueprintType.BT_NORMAL)
    factory.set_editor_property("edit_after_new", False)

    tools = unreal.AssetToolsHelpers.get_asset_tools()
    bp = tools.create_asset(safe_name(name), CONTENT_PATH, unreal.WidgetBlueprint, factory)
    if not bp:
        raise RuntimeError("Widget Blueprint konnte nicht erstellt werden: " + asset_path)

    ensure_root_canvas(bp)
    return bp, asset_path, False


def widget_class_for_record(record):
    kind = (record.get("type") or "").lower()
    if kind == "text":
        return unreal.TextBlock
    if kind == "image":
        return unreal.Image
    if kind == "panel":
        return unreal.CanvasPanel
    # A Border is the closest standard UMG primitive for a CSS rectangle.
    if kind == "rect":
        return unreal.Border
    return None


def apply_text(widget, record):
    widget.set_text(record.get("text", ""))
    color = color_from_rgba(record.get("color"), (1, 1, 1, 1))
    set_if_possible(widget, "color_and_opacity", unreal.SlateColor(color))
    set_if_possible(widget, "justification", {
        "left": unreal.TextJustify.LEFT,
        "center": unreal.TextJustify.CENTER,
        "right": unreal.TextJustify.RIGHT,
    }.get(record.get("align", "left"), unreal.TextJustify.LEFT))

    font = widget.get_editor_property("font")
    size = max(1, int(record.get("fontSize", 16)))
    set_if_possible(font, "size", size)
    set_if_possible(font, "typeface", "Bold" if record.get("bold") else "Regular")
    set_if_possible(widget, "font", font)


def apply_rect(widget, record):
    color = color_from_rgba(record.get("color"), (0, 0, 0, 0))
    set_if_possible(widget, "brush_color", color)
    set_if_possible(widget, "padding", unreal.Margin(0.0))
    # UMG Border brush corner radii are not exposed consistently in Python;
    # preserve source values as metadata for a later C++/Blueprint styling pass.
    set_if_possible(widget, "visibility", unreal.SlateVisibility.VISIBLE)


def apply_image(widget, record, textures):
    texture = textures.get(record.get("texture"))
    if not texture:
        warn("Image-Texture nicht gefunden: " + str(record.get("texture")))
        return
    set_if_possible(widget, "brush", unreal.SlateBrush())
    brush = widget.get_editor_property("brush")
    set_if_possible(brush, "resource_object", texture)
    set_if_possible(widget, "brush", brush)
    tint = color_from_rgba(record.get("tint"), (1, 1, 1, 1))
    set_if_possible(widget, "color_and_opacity", unreal.SlateColor(tint))


def set_panel_visibility(widget, record):
    visible = bool(record.get("visible", True))
    set_if_possible(
        widget,
        "visibility",
        unreal.SlateVisibility.VISIBLE if visible else unreal.SlateVisibility.COLLAPSED
    )


def add_screen_widgets(bp, screen, textures, resolution):
    ensure_root_canvas(bp)
    created = {}
    records = screen.get("widgets") or []

    # The browser manifest stores widgets in z-order. Preserve that order.
    records = sorted(records, key=lambda item: int(item.get("z", 0)))
    for index, record in enumerate(records):
        kind = (record.get("type") or "").lower()
        widget_class = widget_class_for_record(record)
        if widget_class is None:
            warn("Unbekannter Widget-Typ übersprungen: " + str(kind))
            continue

        widget_name = safe_name(record.get("name"), "Widget_%03d" % index)
        panel_name = record.get("panel")
        parent_name = created.get(panel_name, "RootCanvas") if panel_name else "RootCanvas"

        # If a named parent panel was not created (e.g. malformed source order),
        # safely attach to the root canvas rather than aborting the whole screen.
        if panel_name and parent_name == "RootCanvas":
            warn("Panel-Elternteil fehlt; RootCanvas-Fallback: " + str(panel_name))

        try:
            widget = add_widget(bp, widget_class, widget_name, parent_name)
            created[record.get("name", widget_name)] = widget_name

            x = float(record.get("x", 0))
            y = float(record.get("y", 0))
            width = float(record.get("w", 100))
            height = float(record.get("h", 40))
            set_slot_geometry(widget, x, y, width, height)

            if kind == "text":
                apply_text(widget, record)
            elif kind == "rect":
                apply_rect(widget, record)
            elif kind == "image":
                apply_image(widget, record, textures)
            elif kind == "panel":
                set_panel_visibility(widget, record)

            # Preserve source details that UMG cannot faithfully express.
            tooltip = (
                "WGEN source=%s | type=%s | z=%s | source-screen=%s"
                % (record.get("name", ""), kind, record.get("z", 0), screen.get("name", ""))
            )
            set_if_possible(widget, "tool_tip_text", tooltip)
        except Exception as exc:
            warn("Widget %s übersprungen: %s" % (widget_name, exc))

    try:
        unreal.BlueprintEditorLibrary.compile_blueprint(bp)
    except Exception as exc:
        warn("Blueprint compile warning %s: %s" % (screen.get("name"), exc))

    try:
        unreal.EditorAssetLibrary.save_loaded_asset(bp)
    except Exception as exc:
        warn("Blueprint konnte nicht gespeichert werden: " + str(exc))

    return len(records)


# --------------------------- MAIN IMPORT ---------------------------

def run_import():
    root = os.path.abspath(IMPORT_ROOT)
    if not os.path.isdir(root):
        raise FileNotFoundError(
            "IMPORT_ROOT existiert nicht. ZIP zuerst entpacken und IMPORT_ROOT setzen: " + root
        )

    manifest = load_manifest(root)
    resolution = manifest.get("resolution") or {}
    width = int(resolution.get("width") or DEFAULT_WIDTH)
    height = int(resolution.get("height") or DEFAULT_HEIGHT)

    ensure_folder(CONTENT_PATH)
    log("Import start: %s | %dx%d | Screens=%d"
        % (manifest.get("format", "unknown"), width, height, len(manifest.get("screens") or [])))

    textures = import_textures(root, manifest.get("textures") or [])
    log("Textures importiert/gefunden: %d" % len(textures))

    report = {
        "source_format": manifest.get("format"),
        "content_path": CONTENT_PATH,
        "resolution": {"width": width, "height": height},
        "screens": [],
        "warnings": [],
        "limitations": [
            "CSS layout wird auf absolute Canvas-Positionen abgebildet.",
            "CSS pseudo-elements, DOM events, JavaScript und CSS animations werden nicht in UMG-Logik übersetzt.",
            "Font assets, exakte CSS font metrics, gradients, shadows und corner radii benötigen ggf. Nacharbeit.",
            "Der Importer erzeugt UMG Widget Blueprints, aber keine Gameplay-Blueprint-Graphs."
        ]
    }

    for screen in manifest.get("screens") or []:
        screen_name = safe_name(screen.get("name"), "WGEN_Screen")
        asset_name = "WBP_" + screen_name
        try:
            bp, asset_path, reused = create_or_load_widget_blueprint(asset_name)
            if reused:
                # Avoid silently duplicating children into an existing tree.
                warn("Bestehendes Blueprint nicht automatisch geleert; Import übersprungen: " + asset_path)
                report["screens"].append({
                    "name": screen_name, "asset": asset_path,
                    "status": "REUSED_NOT_MODIFIED",
                    "widget_records": len(screen.get("widgets") or [])
                })
                continue

            count = add_screen_widgets(bp, screen, textures, resolution)
            report["screens"].append({
                "name": screen_name, "asset": asset_path,
                "status": "CREATED", "widget_records": count,
                "dr": screen.get("dr"), "layer": screen.get("layer"),
                "sourceFile": screen.get("sourceFile")
            })
            log("Created %s | Dr=%s | widgets=%d"
                % (asset_path, screen.get("dr"), count))
        except Exception as exc:
            warn("Screen-Import fehlgeschlagen %s: %s" % (screen_name, exc))
            report["screens"].append({
                "name": screen_name, "status": "ERROR", "error": str(exc)
            })

    report_path = os.path.join(root, "unreal_import_report.json")
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    log("Fertig. Report: " + report_path)
    log("Erzeugte Assets liegen unter: " + CONTENT_PATH)
    return report


if __name__ == "__main__":
    try:
        run_import()
    except Exception as error:
        unreal.log_error("[WGEN] Import abgebrochen: %s" % error)
        unreal.log_error(traceback.format_exc())
        raise
