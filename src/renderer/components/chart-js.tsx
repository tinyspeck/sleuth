import React, {useEffect, useCallback} from 'react';
import { Chart, ChartConfiguration, InteractionItem } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { useRefReRender  } from '../hooks/use-ref-rerender';

export { InteractionItem } from 'chart.js/auto';
interface ChartJSProps {
    type: ChartConfiguration['type'];
    data: ChartConfiguration['data'];
    options: ChartConfiguration['options'];
    plugins: ChartConfiguration['plugins'];
    getElementAtEvent?: (items: Array<InteractionItem>, e: Event) => void;
}

const ChartJSChart = React.memo(function (props: ChartJSProps) {
    const {data, type, options, plugins, getElementAtEvent} = props;

    const [getCanvas, setCanvas] = useRefReRender<HTMLCanvasElement>(null);
    const [getChart, setChart] = useRefReRender<Chart | null>(null, (chart) => chart?.destroy());

    useEffect(() => {
        const canvas = getCanvas();
        if (!canvas) return;
        const chart = new Chart(canvas, {
            type,
            data,
            options,
            plugins
        });
        setChart(chart);
    }, []);

    useEffect(() => {
        const chart = getChart();
        if (!chart) return;
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

    const onClick = useCallback((e) => {
        const chart = getChart();
        if (chart && getElementAtEvent) {
            getElementAtEvent(
                chart.getElementsAtEventForMode(
                    e,
                    'nearest',
                    { intersect: true },
                    false
                ),
                e
            );
        }
    }, [getElementAtEvent]);
    return (
        <canvas
            ref={setCanvas}
            role='img'
            onClick={onClick}
            />
    );
});

ChartJSChart.displayName = 'ChartJSChart';

export { ChartJSChart };