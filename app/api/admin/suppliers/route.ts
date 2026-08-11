import { listSupplierSummaries } from "../../../../lib/catalog.server";
import { getAuthorizedAdmin } from "../../../admin-auth";

export async function GET() {
  if (!(await getAuthorizedAdmin())) return Response.json({ error: "Требуется вход администратора." }, { status: 401 });
  try {
    return Response.json({ suppliers: await listSupplierSummaries() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Не удалось загрузить поставщиков." }, { status: 400 });
  }
}
