import React from "react"

export interface NumberResultsProps {
	numberOfResults: number;
}

export default function NumberResults(props: NumberResultsProps){
	const conversion = (numberToConvert: number): string => {
		return numberToConvert.toLocaleString();
	}

	return (
		<div id="numberResultsContainer">
			<p id="numberResults">{conversion(props.numberOfResults)}</p>
			<p id="resultTag">{props.numberOfResults === 1 ? 'result' : 'results'}</p>
		</div>
	)
}