import React, {useRef, useEffect} from 'react';
import { Chart, ChartConfiguration, InteractionItem } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

export { InteractionItem } from 'chart.js/auto';
interface ChartJSProps {
    type: ChartConfiguration['type'];
    data: ChartConfiguration['data'];
    options: ChartConfiguration['options'];
    plugins: ChartConfiguration['plugins'];
    getElementAtEvent?: (items: Array<InteractionItem>, e: React.MouseEvent<HTMLCanvasElement>) => any;
}
const ChartJSChart = React.memo(function (props: ChartJSProps) {
    const {data, type, options, plugins, getElementAtEvent} = props;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart | null>(null);

    useEffect(() => {
        if (!chartRef.current) return;
        const chart = chartRef.current;
        const {datasets: currentDatasets} = chart.data;
        const {datasets} = data;
        for (const dataset of datasets) {
            const found = currentDatasets.find((currentDataSet) => {
                return currentDataSet.label === dataset.label;
            });
            if (found) {
                Object.assign(found, dataset, {
                    data: dataset.data
                  });
            } else {
                currentDatasets.push(dataset);
            }
        }
        chart.update('none');
    }, [data]);

    useEffect(() => {
        if (!canvasRef.current) return;

        chartRef.current = new Chart(canvasRef.current, {
            type,
            data,
            options,
            plugins
        });
        return () => chartRef.current?.destroy();
    }, []);

    const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (chartRef.current && getElementAtEvent) {
            getElementAtEvent(
                chartRef.current.getElementsAtEventForMode(
                  e as any,
                  'nearest',
                  { intersect: true },
                  false
                ),
                e
              );
        }
      };
    return (

        <canvas
            ref={canvasRef}
            width={150}
            height={300}
            role='img'
            onClick={onClick}
            />
    );
});

export { ChartJSChart };