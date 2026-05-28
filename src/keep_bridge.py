#!/usr/bin/env python3
"""
Bridge Python para Google Keep.
Se comunica con Node.js via stdin/stdout en JSON.
"""

import sys
import json
import os
import gkeepapi

SESSION_FILE = os.path.join(os.path.dirname(__file__), '..', 'sessions', 'keep_session.json')


def get_keep():
    keep = gkeepapi.Keep()
    if os.path.exists(SESSION_FILE):
        with open(SESSION_FILE, 'r') as f:
            master_token = f.read().strip()
        try:
            email = os.environ.get('GOOGLE_KEEP_EMAIL', '')
            keep.resume(email, master_token)
            keep.sync()
            return keep
        except Exception:
            pass
    return None


def login(email, password):
    keep = gkeepapi.Keep()
    try:
        keep.login(email, password)
        os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
        with open(SESSION_FILE, 'w') as f:
            f.write(keep.getMasterToken())
        return {"success": True, "message": "Sesión iniciada correctamente"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def list_notes(keep, query=None):
    notes = []
    all_notes = keep.find(query=query) if query else keep.all()
    for note in all_notes:
        notes.append({
            "id": note.id,
            "title": note.title,
            "text": note.text,
            "color": str(note.color),
            "pinned": note.pinned,
            "archived": note.archived,
            "labels": [label.name for label in note.labels],
            "trashed": note.trashed,
        })
    return notes


def get_note(keep, note_id):
    note = keep.get(note_id)
    if note:
        return {
            "id": note.id,
            "title": note.title,
            "text": note.text,
            "color": str(note.color),
            "pinned": note.pinned,
            "archived": note.archived,
            "labels": [label.name for label in note.labels],
            "trashed": note.trashed,
        }
    return None


def search_notes(keep, query):
    results = keep.find(query=query)
    notes = []
    for note in results:
        notes.append({
            "id": note.id,
            "title": note.title,
            "text": note.text,
            "labels": [label.name for label in note.labels],
        })
    return notes


def handle_request(request):
    cmd = request.get("command", "")
    keep = get_keep()

    if cmd == "login":
        return login(request["email"], request["password"])

    if not keep:
        return {"success": False, "error": "No autenticado. Usa 'login' primero."}

    if cmd == "list":
        notes = list_notes(keep, request.get("query"))
        return {"success": True, "notes": notes, "count": len(notes)}

    if cmd == "get":
        note = get_note(keep, request["note_id"])
        if note:
            return {"success": True, "note": note}
        return {"success": False, "error": "Nota no encontrada"}

    if cmd == "search":
        notes = search_notes(keep, request["query"])
        return {"success": True, "notes": notes, "count": len(notes)}

    if cmd == "list_labels":
        keep.sync()
        labels = [{"name": label.name} for label in keep.labels()]
        return {"success": True, "labels": labels}

    return {"success": False, "error": f"Comando desconocido: {cmd}"}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError as e:
            print(json.dumps({"success": False, "error": f"JSON inválido: {str(e)}"}), flush=True)
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
