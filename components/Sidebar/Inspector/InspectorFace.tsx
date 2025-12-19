import React, { useRef, useEffect } from 'react';
import { drawAvatarHead } from '../../../utils/render/pixelArt';
import { SimData } from '../../../types';

interface InspectorFaceProps {
    sim: SimData;
    size?: number;
}

export const InspectorFace: React.FC<InspectorFaceProps> = ({ sim, size = 64 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, size, size);
                // Adjust drawing parameters based on size
                const headSize = size === 64 ? 20 : 12;
                const centerX = size / 2;
                const centerY = size === 64 ? 40 : 25;
                drawAvatarHead(ctx, centerX, centerY, headSize, sim);
            }
        }
    }, [sim, size]);

    return <canvas ref={canvasRef} width={size} height={size} />;
};