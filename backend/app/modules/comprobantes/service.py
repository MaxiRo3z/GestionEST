from io import BytesIO
from fpdf import FPDF
from datetime import datetime

class PDFComprobante(FPDF):
    def header(self):
        # 1. Membrete del Instituto
        self.set_font("helvetica", "B", 18)
        self.set_text_color(31, 41, 55) # Gris oscuro (Slate 800)
        self.cell(0, 8, "INSTITUTO EDUCATIVO", border=0, new_x="LMARGIN", new_y="NEXT", align="L")
        
        self.set_font("helvetica", "", 9)
        self.set_text_color(107, 114, 128) # Gris medio
        self.cell(0, 5, "Av. Principal 1234, Ciudad", border=0, new_x="LMARGIN", new_y="NEXT", align="L")
        self.cell(0, 5, "Tel: +54 9 11 1234-5678 | Email: contacto@instituto.edu.ar", border=0, new_x="LMARGIN", new_y="NEXT", align="L")
        self.ln(5)
        
        # Línea separadora superior
        self.set_draw_color(229, 231, 235) # Gris claro
        self.set_line_width(0.5)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(8)

    def footer(self):
        # 4. Textos Legales en el pie de página
        self.set_y(-15)
        self.set_font("helvetica", "I", 8)
        self.set_text_color(156, 163, 175)
        self.cell(0, 10, "Documento de uso interno - No válido como factura fiscal.", border=0, align="C")

def generar_pdf_bytes(
    titulo: str, 
    numero: str, 
    destinatario: str, 
    concepto: str, 
    metodo_pago: str,
    desglose: list[tuple[str, str]], # Lista de (Descripción, Monto)
    total: str
) -> BytesIO:
    pdf = PDFComprobante()
    pdf.add_page()
    
    # --- BLOQUE DE INFORMACIÓN DEL COMPROBANTE ---
    pdf.set_font("helvetica", "B", 14)
    pdf.set_text_color(31, 41, 55)
    pdf.cell(100, 8, titulo.upper(), border=0, align="L")
    
    pdf.set_font("helvetica", "", 11)
    pdf.cell(90, 8, f"Nro: {numero}", border=0, new_x="LMARGIN", new_y="NEXT", align="R")
    
    pdf.set_text_color(75, 85, 99)
    pdf.cell(100, 6, f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}", border=0, align="L")
    pdf.cell(90, 6, f"Método de pago: {metodo_pago}", border=0, new_x="LMARGIN", new_y="NEXT", align="R")
    
    pdf.ln(10)
    
    # --- DATOS DEL DESTINATARIO ---
    pdf.set_fill_color(248, 250, 252) # Fondo gris super claro
    pdf.set_draw_color(226, 232, 240)
    pdf.rect(10, pdf.get_y(), 190, 25, "DF") # Dibuja un rectángulo con fondo
    
    pdf.set_y(pdf.get_y() + 5)
    pdf.set_x(15)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(30, 6, "A nombre de:", border=0)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(150, 6, destinatario, border=0, new_x="LMARGIN", new_y="NEXT")
    
    pdf.set_x(15)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(30, 6, "Concepto:", border=0)
    pdf.set_font("helvetica", "", 10)
    pdf.cell(150, 6, concepto, border=0, new_x="LMARGIN", new_y="NEXT")
    
    pdf.ln(15)
    
    # --- TABLA DE DESGLOSE (Items) ---
    # Encabezado de la tabla
    pdf.set_fill_color(241, 245, 249)
    pdf.set_font("helvetica", "B", 10)
    pdf.cell(140, 10, "  Descripción", border=1, fill=True)
    pdf.cell(50, 10, "Importe", border=1, new_x="LMARGIN", new_y="NEXT", align="C", fill=True)
    
    # Filas dinámicas
    pdf.set_font("helvetica", "", 10)
    for desc, monto in desglose:
        pdf.cell(140, 10, f"  {desc}", border=1)
        pdf.cell(50, 10, monto, border=1, new_x="LMARGIN", new_y="NEXT", align="R")
        
    pdf.ln(5)
    
    # --- TOTAL ---
    pdf.set_font("helvetica", "B", 12)
    pdf.cell(140, 10, "TOTAL ABONADO", border=0, align="R")
    pdf.set_text_color(5, 150, 105) # Verde esmeralda para el total
    pdf.set_font("helvetica", "B", 14)
    pdf.cell(50, 10, total, border=0, align="R")
    
    buffer = BytesIO()
    pdf.output(buffer)
    buffer.seek(0)
    return buffer