import makerjs from 'makerjs';

export class ExportService {
  static generateSVG(fullModel: makerjs.IModel): string {
    return makerjs.exporter.toSVG(fullModel, {
      units: makerjs.unitType.Millimeter,
      stroke: 'black',
      strokeWidth: '0.5px',
      fill: 'none',
    });
  }

  static generateDXF(fullModel: makerjs.IModel): string {
    return makerjs.exporter.toDXF(fullModel, {
      units: makerjs.unitType.Millimeter
    });
  }

  static downloadFile(content: string, mimeType: string, filename: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
