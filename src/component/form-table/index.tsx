import './style.scss';

interface TableRowProps {
	title: React.ReactNode;
	children: React.ReactNode;
}

export const TableRow = ( props: TableRowProps ) => {
	const { title, children } = props;

	return (
		<tr>
			<th>{ title }</th>
			<td>{ children }</td>
		</tr>
	);
};

interface FormTableProps {
	children: React.ReactNode;
}

export const FormTable = ( props: FormTableProps ) => {
	return (
		<table className="form-table">
			<tbody>{ props.children }</tbody>
		</table>
	);
};
