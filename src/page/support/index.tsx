import About from './about';
import HttpTester from './http-tester';
import Status from './status';

function Support() {
	return (
		<>
			<section className="dsr-card">
				<Status />
			</section>
			<section className="dsr-card">
				<HttpTester />
			</section>
			<section className="dsr-card">
				<About />
			</section>
		</>
	);
}

export default Support;
