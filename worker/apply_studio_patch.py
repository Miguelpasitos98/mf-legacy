"""Install the focused Studio parser patch, keeping timestamped backups."""
import argparse
from datetime import datetime, timezone
from pathlib import Path
import shutil


def apply(root):
    root=Path(root).resolve()
    source=Path(__file__).resolve().parent/'studio_patch'/'app'
    if not (root/'app/profile.py').is_file():
        raise ValueError('No se localiza una instalación existente de MF Legacy Studio.')
    backup=root/'RESPALDOS'/('IMPORT_STATS_'+datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f'))/'app'
    files=sorted(source.glob('*.py'))
    if not files:raise ValueError('Falta el paquete de parches Studio.')
    for file in files:
        if not (root/'app'/file.name).is_file():raise ValueError('Falta módulo original: '+file.name)
    changed=[]
    for file in files:
        target=root/'app'/file.name
        if target.read_bytes()==file.read_bytes():continue
        backup.mkdir(parents=True,exist_ok=True)
        shutil.copy2(target,backup/file.name)
        shutil.copy2(file,target)
        changed.append(file.name)
    return {'changed':changed,'backup':str(backup) if changed else None}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Aplicar reparación de importación a Studio sin modificar cachés.')
    parser.add_argument('studio_root',type=Path)
    print(apply(parser.parse_args().studio_root))
