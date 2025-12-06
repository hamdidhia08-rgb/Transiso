import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import pool from '@/lib/db';

function getIdFromReq(req: NextRequest) {
  const url = req.nextUrl;
  const parts = url.pathname.split('/');
  return parts[parts.length - 1]; // récupère le dernier segment (id)
}

// GET /api/services/[id]
function getServiceIdFromReq(req: NextRequest) {
  const url = req.nextUrl;
  const parts = url.pathname.split('/');
  return parts[parts.length - 1]; // dernier segment = service_id
}

export async function GET(req: NextRequest) {
  const service_id = getServiceIdFromReq(req);
  const lang = req.nextUrl.searchParams.get('lang') || 'en';

  try {
    // Récupérer le service par service_id ET langue
    const [rows]: any = await pool.query(
      `SELECT * FROM services WHERE service_id = ? AND lang = ? LIMIT 1`,
      [service_id, lang]
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Service non trouvé' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/services/[service_id]
export async function PUT(req: NextRequest) {
  const service_id = getServiceIdFromReq(req);

  try {
    const formData = await req.formData();

    const title = formData.get('title')?.toString() || '';
    const description = formData.get('description')?.toString() || '';
    const content = formData.get('content')?.toString() || '';
    const iconFile = formData.get('icon') as File | null;

    let iconPath = '';

    if (iconFile) {
      const bytes = await iconFile.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadDir = path.join('public', 'uploads', 'services');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const fileName = `icon_${Date.now()}.jpg`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);
      iconPath = `/uploads/services/${fileName}`;

      // Supprimer ancien fichier
      const oldResult = await pool.query(
        'SELECT icon_path FROM services WHERE service_id = ?',
        [service_id]
      );
      const oldRows = oldResult[0] as any[];
      const oldIcon = oldRows[0]?.icon_path;

      if (oldIcon) {
        const oldFullPath = path.join('public', oldIcon);
        if (fs.existsSync(oldFullPath)) {
          fs.unlinkSync(oldFullPath);
        }
      }
    }

    let updateQuery = `
      UPDATE services 
      SET title = ?, description = ?, content = ?
    `;
    const paramsArray = [title, description, content];

    if (iconPath) {
      updateQuery += `, icon_path = ?`;
      paramsArray.push(iconPath);
    }

    updateQuery += ' WHERE service_id = ?';
    paramsArray.push(service_id);

    await pool.query(updateQuery, paramsArray);

    return NextResponse.json({ message: 'Service mis à jour avec succès.' });
  } catch (error) {
    console.error('Erreur PUT Service:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/services/[id]
export async function DELETE(req: NextRequest) {
  const id = getIdFromReq(req);

  try {
    // Supprimer l'image liée si elle existe
    const result = await pool.query('SELECT icon_path FROM services WHERE id = ?', [id]);
    const rows = result[0] as any[];
    const iconPath = rows[0]?.icon_path;

    if (iconPath) {
      const fullPath = path.join('public', iconPath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    const deleteResult = await pool.query('DELETE FROM services WHERE id = ?', [id]);
    const deleteInfo = deleteResult[0] as any;

    if (deleteInfo.affectedRows === 0) {
      return NextResponse.json({ error: 'Service introuvable.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Service supprimé avec succès.' });
  } catch (error) {
    console.error('Erreur DELETE Service:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
