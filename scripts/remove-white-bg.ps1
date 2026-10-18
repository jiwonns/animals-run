# Makes the solid background (white, gray, any flat color) of every PNG in -SrcDir transparent
# and resizes it into -DstDir. The background color is sampled from the image corners.
# Example: powershell -ExecutionPolicy Bypass -File scripts\remove-white-bg.ps1 -SrcDir "$HOME\Downloads\winter" -DstDir assets\gacha\winter\characters
param([Parameter(Mandatory)][string]$SrcDir, [Parameter(Mandatory)][string]$DstDir, [int]$Size = 512)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class KeyOut {
    // Removes the background connected to the image border, feathering the anti-aliased rim.
    // A pixel is background when no channel differs from the corner color by more than `hard`;
    // rim pixels fade out until the difference reaches `soft`.
    public static Bitmap Run(Bitmap src, int hard, int soft) {
        int w = src.Width, h = src.Height;
        Bitmap bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);
        BitmapData data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        byte[] px = new byte[stride * h];
        Marshal.Copy(data.Scan0, px, 0, px.Length);

        int[] corners = { 2 * stride + 8, 2 * stride + (w - 3) * 4, (h - 3) * stride + 8, (h - 3) * stride + (w - 3) * 4 };
        if (px[corners[0] + 3] == 0) { bmp.UnlockBits(data); return bmp; }
        int[] bgc = new int[3];
        for (int c = 0; c < 3; c++) { foreach (int i in corners) bgc[c] += px[i + c]; bgc[c] /= corners.Length; }
        Func<int, int> dist = i => Math.Max(Math.Abs(px[i] - bgc[0]), Math.Max(Math.Abs(px[i + 1] - bgc[1]), Math.Abs(px[i + 2] - bgc[2])));

        bool[] bg = new bool[w * h];
        Queue<int> q = new Queue<int>();
        Action<int, int> seed = (x, y) => {
            int k = y * w + x;
            if (!bg[k] && dist(y * stride + x * 4) <= hard) { bg[k] = true; q.Enqueue(k); }
        };
        for (int x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
        for (int y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
        while (q.Count > 0) {
            int k = q.Dequeue(); int x = k % w, y = k / w;
            if (x > 0) seed(x - 1, y);
            if (x < w - 1) seed(x + 1, y);
            if (y > 0) seed(x, y - 1);
            if (y < h - 1) seed(x, y + 1);
        }

        for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
            int k = y * w + x, i = y * stride + x * 4;
            if (bg[k]) { px[i + 3] = 0; continue; }
            bool rim = (x > 0 && bg[k - 1]) || (x < w - 1 && bg[k + 1]) || (y > 0 && bg[k - w]) || (y < h - 1 && bg[k + w]);
            int d = dist(i);
            if (rim && d < soft) px[i + 3] = (byte)Math.Max(0, Math.Min(255, (d - hard) * 255 / (soft - hard)));
        }
        Marshal.Copy(px, 0, data.Scan0, px.Length);
        bmp.UnlockBits(data);
        return bmp;
    }
}
"@

New-Item -ItemType Directory -Force -Path $DstDir | Out-Null
Get-ChildItem -LiteralPath $SrcDir -Filter *.png | ForEach-Object {
    $src = [System.Drawing.Bitmap]::FromFile($_.FullName)
    $keyed = [KeyOut]::Run($src, 18, 60)
    $out = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($out)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($keyed, 0, 0, $Size, $Size)
    $g.Dispose()
    $dst = Join-Path $DstDir $_.Name
    $out.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose(); $keyed.Dispose(); $src.Dispose()
    "{0} -> {1} KB" -f $_.Name, [math]::Round((Get-Item $dst).Length / 1KB)
}
