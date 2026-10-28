<?php

class Log_Redirect_Test extends WP_UnitTestCase {
	public function testCsvRow() {
		$row = [ 'created' => 'created', 'url' => 'url', 'sent_to' => 'sent_to', 'ip' => 'ip', 'referrer' => 'referrer', 'agent' => 'agent' ];
		$expected = [ 'created', 'url', 'sent_to', 'ip', 'referrer', 'agent' ];
		$csv = Red_Redirect_Log::get_csv_row( (object) $row );

		$this->assertEquals( $expected, $csv );
	}

	public function testCsvRowReturnsRawFormulaValues() {
		$row = [ 'created' => '=created', 'url' => '@url', 'sent_to' => '-sent_to', 'ip' => '+ip', 'referrer' => '=referrer', 'agent' => '@agent' ];
		$expected = [ '=created', '@url', '-sent_to', '+ip', '=referrer', '@agent' ];
		$csv = Red_Redirect_Log::get_csv_row( (object) $row );

		$this->assertEquals( $expected, $csv );
	}

	public function testCsvRowLeavesLeadingWhitespaceWithoutFormulaPrefixAlone() {
		$row = [ 'created' => "\thello", 'url' => "\nurl", 'sent_to' => "\rsent_to", 'ip' => ' ip', 'referrer' => "\treferrer", 'agent' => "\nagent" ];
		$expected = [ "\thello", "\nurl", "\rsent_to", ' ip', "\treferrer", "\nagent" ];
		$csv = Red_Redirect_Log::get_csv_row( (object) $row );

		$this->assertEquals( $expected, $csv );
	}

	public function testCredentialsRedactedFromLog() {
		global $wpdb;

		// A password reset link holds a working key for the account
		$id = Red_Redirect_Log::create( 'domain', '/wp-login.php?action=rp&key=SECRETKEY&login=victim', '192.168.1.1', [
			'referrer' => 'https://example.org/?token=SECRETTOKEN&page=2',
			'target' => '/next?_wpnonce=SECRETNONCE',
		] );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}redirection_logs WHERE id=%d", $id ) );
		$stored = $row->url . ' ' . $row->referrer . ' ' . $row->sent_to;

		$this->assertStringNotContainsString( 'SECRET', $stored );
		$this->assertStringNotContainsString( 'victim', $stored );
		$this->assertStringContainsString( 'action=rp', $row->url );
		$this->assertStringContainsString( 'page=2', $row->referrer );
	}

	public function testCredentialsRedactedFromLoggedHeaders() {
		global $wpdb;

		$id = Red_Redirect_Log::create( 'domain', '/a', '192.168.1.1', [ 'request_data' => [ 'headers' => [ 'Referer' => '/r?key=SECRETKEY', 'X-Big' => str_repeat( 'a', 5000 ) ] ] ] );
		$data = $wpdb->get_var( $wpdb->prepare( "SELECT request_data FROM {$wpdb->prefix}redirection_logs WHERE id=%d", $id ) );

		$this->assertStringNotContainsString( 'SECRET', $data );
		$this->assertLessThan( 1000, strlen( $data ) );
	}

	public function testRedactionCoversArrayNamesSeparatorsAndEncodedNames() {
		$this->assertStringNotContainsString( 'SECRET', Red_Redirect_Log::redact_url( '/a?pass[0]=SECRET1&x=1' ) );
		$this->assertStringNotContainsString( 'SECRET', Red_Redirect_Log::redact_url( '/a?x=1;token=SECRET2' ) );
		$this->assertStringNotContainsString( 'SECRET', Red_Redirect_Log::redact_url( '/a?rp_key=SECRET3&new_password=SECRET4' ) );

		global $wpdb;
		$id = Red_Redirect_Log::create( 'domain', '/a', '1.1.1.1', [ 'referrer' => '/r?pa%73s=SECRET5', 'target' => '/t?to%6Ben=SECRET6' ] );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT referrer, sent_to FROM {$wpdb->prefix}redirection_logs WHERE id=%d", $id ) );
		$this->assertStringNotContainsString( 'SECRET', $row->referrer . ' ' . $row->sent_to );
	}

	public function testCredentialsRedactedFrom404Log() {
		global $wpdb;

		$id = Red_404_Log::create( 'domain', '/missing?password=SECRETPASS&x=1', '192.168.1.1', [ 'referrer' => '/r?access_token=SECRETTOKEN' ] );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$wpdb->prefix}redirection_404 WHERE id=%d", $id ) );

		$this->assertStringNotContainsString( 'SECRET', $row->url . ' ' . $row->referrer );
		$this->assertStringContainsString( 'x=1', $row->url );
	}

	public function testValidLog() {
		$log = Red_Redirect_Log::create( 'domain', 'url', '192.168.1.1', [
			'agent' => 'agent',
			'referrer' => 'referrer',
			'http_code' => 301,
			'request_method' => 'GET',
			'redirect_id' => 5,
			'target' => 'target',
			'redirect_by' => 'wordpress',
			'request_data' => [
				'cats' => 4,
			],
		] );

		$json = Red_Redirect_Log::get_by_id( $log )->to_json();
		$expected = [
			'url' => 'url',
			'agent' => 'agent',
			'referrer' => 'referrer',
			'domain' => 'domain',
			'ip' => '192.168.1.1',
			'http_code' => 301,
			'request_method' => 'GET',
			'request_data' => [
				'cats' => 4,
			],
			'sent_to' => 'target',
			'redirection_id' => 5,
			'redirect_by_slug' => 'wordpress',
			'redirect_by' => 'WordPress',
		];

		unset( $json['created'] );
		unset( $json['created_time'] );
		unset( $json['id'] );

		$this->assertEquals( $expected, $json );
	}

	public function testEmptyRedirectLog() {
		$log = Red_Redirect_Log::create( 'domain', 'url', '192.168.1.1', [
			'agent' => 'agent',
			'referrer' => 'referrer',
			'http_code' => 301,
			'request_method' => 'GET',
			'request_data' => [
				'cats' => 4,
			],
		] );

		$entry = Red_Redirect_Log::get_by_id( $log );

		$json = $entry->to_json();
		$expected = [
			'url' => 'url',
			'agent' => 'agent',
			'referrer' => 'referrer',
			'domain' => 'domain',
			'ip' => '192.168.1.1',
			'http_code' => 301,
			'request_method' => 'GET',
			'request_data' => [
				'cats' => 4,
			],
			'sent_to' => '',
			'redirection_id' => 0,
			'redirect_by_slug' => '',
			'redirect_by' => '',
		];

		unset( $json['created'] );
		unset( $json['created_time'] );
		unset( $json['id'] );

		$this->assertEquals( $expected, $json );
	}

	public function testGoodQuery() {
		$query = [
			'page' => 4,
			'per_page' => 20,
			'direction' => 'asc',
			'orderby' => 'ip',
			'filterBy' => [
				'target' => 'target',
				'redirect_by' => 'redirect_by',
			],
		];
		$expected = [
			'orderby' => 'ip',
			'direction' => 'ASC',
			'limit' => 20,
			'offset' => 20 * 4,
			'where' => "WHERE sent_to LIKE '%target%' AND redirect_by = 'redirect_by'",
		];
		$query = Red_Redirect_Log::get_query( $query );
		$query['where'] = preg_replace( '/\{.*?\}/', '%', $query['where'] );

		$this->assertEquals( $expected, $query );
	}
}
