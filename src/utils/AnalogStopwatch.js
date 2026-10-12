/**
 * AnalogStopwatch — Renderer for the iOS-style analog stopwatch.
 * Draws the outer seconds dial, the inner minutes sub-dial, and the animated hands.
 */
export class AnalogStopwatch {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // HiDPI scaling
        this.dpr = window.devicePixelRatio || 1;
        this.cssSize = 300;
        this.canvas.width = this.cssSize * this.dpr;
        this.canvas.height = this.cssSize * this.dpr;
        this.canvas.style.width = `${this.cssSize}px`;
        this.canvas.style.height = `${this.cssSize}px`;
        this.ctx.scale(this.dpr, this.dpr);

        // Center and radius
        this.cx = this.cssSize / 2;
        this.cy = this.cssSize / 2;
        this.outerRadius = this.cssSize / 2 - 10;

        // Sub-dial
        this.subCx = this.cx;
        this.subCy = this.cy - 62;
        this.subRadius = 35;

        // Colors
        this.handColor = '#ff9f0a';
        this.tickColor = '#d1d1d6';
        this.numberColor = '#d1d1d6';
        this.bgColor = '#000000';
        this.subHandColor = '#ffffff';
    }

    draw(elapsedMs) {
        const ctx = this.ctx;
        const size = this.cssSize;

        ctx.clearRect(0, 0, size, size);

        this.drawOuterDial();
        this.drawSubDial(elapsedMs);
        this.drawSecondsHand(elapsedMs);
    }

    drawOuterDial() {
        const ctx = this.ctx;
        const cx = this.cx;
        const cy = this.cy;
        const r = this.outerRadius;

        // Tick marks
        for (let i = 0; i < 60; i++) {
            const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const isMajor = i % 5 === 0;
            const isHalf = i % 5 !== 0 && i % 1 === 0;

            const outerLen = r;
            const innerLen = isMajor ? r - 16 : r - 8;
            const lineWidth = isMajor ? 2.5 : 1;

            const x1 = cx + Math.cos(angle) * outerLen;
            const y1 = cy + Math.sin(angle) * outerLen;
            const x2 = cx + Math.cos(angle) * innerLen;
            const y2 = cy + Math.sin(angle) * innerLen;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = this.tickColor;
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }

        // Numbers (5, 10, 15 ... 55, 60)
        ctx.fillStyle = this.numberColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < 12; i++) {
            const num = i === 0 ? 60 : i * 5;
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const textR = r - 30;
            const x = cx + Math.cos(angle) * textR;
            const y = cy + Math.sin(angle) * textR;

            ctx.font = `bold ${num === 60 ? 22 : 20}px -apple-system, "Segoe UI", sans-serif`;
            ctx.fillText(num.toString(), x, y);
        }
    }

    drawSubDial(elapsedMs) {
        const ctx = this.ctx;
        const cx = this.subCx;
        const cy = this.subCy;
        const r = this.subRadius;

        // Outer ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Tick marks
        for (let i = 0; i < 30; i++) {
            const angle = (i / 30) * Math.PI * 2 - Math.PI / 2;
            const isMajor = i % 5 === 0;

            const outerLen = r - 1;
            const innerLen = isMajor ? r - 8 : r - 4;
            const lineWidth = isMajor ? 1.5 : 0.5;

            const x1 = cx + Math.cos(angle) * outerLen;
            const y1 = cy + Math.sin(angle) * outerLen;
            const x2 = cx + Math.cos(angle) * innerLen;
            const y2 = cy + Math.sin(angle) * innerLen;

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        }

        // Numbers (5, 10, 15, 20, 25, 30)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 9px -apple-system, "Segoe UI", sans-serif`;

        for (let i = 0; i < 6; i++) {
            const num = i === 0 ? 30 : i * 5;
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const textR = r - 14;
            const x = cx + Math.cos(angle) * textR;
            const y = cy + Math.sin(angle) * textR;
            ctx.fillText(num.toString(), x, y);
        }

        // Minute hand (30-minute cycle)
        const totalMinutes = elapsedMs / 60000;
        const minuteAngle = (totalMinutes % 30) / 30 * Math.PI * 2 - Math.PI / 2;
        const handLen = r - 10;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
            cx + Math.cos(minuteAngle) * handLen,
            cy + Math.sin(minuteAngle) * handLen
        );
        ctx.strokeStyle = this.subHandColor;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Center
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = this.handColor;
        ctx.fill();
    }

    drawSecondsHand(elapsedMs) {
        const ctx = this.ctx;
        const cx = this.cx;
        const cy = this.cy;
        const r = this.outerRadius;

        // Second hand 
        const totalSeconds = elapsedMs / 1000;
        const secondAngle = (totalSeconds % 60) / 60 * Math.PI * 2 - Math.PI / 2;
        const handLen = r - 35;
        const tailLen = 25;

        // Tail (opposite direction)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
            cx + Math.cos(secondAngle + Math.PI) * tailLen,
            cy + Math.sin(secondAngle + Math.PI) * tailLen
        );
        ctx.strokeStyle = this.handColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Main hand
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
            cx + Math.cos(secondAngle) * handLen,
            cy + Math.sin(secondAngle) * handLen
        );
        ctx.strokeStyle = this.handColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fillStyle = this.handColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
    }

    destroy() {
        this.ctx = null;
        this.canvas = null;
    }
}
